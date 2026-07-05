# 06 — User Flows

Step-by-step journey maps for every major flow. Markers:
- **[EXTERNAL]** — an external API call or redirect occurs; the user or system leaves the application boundary
- **[FAILURE POINT]** — a step where an error can occur; the recovery path is documented immediately after

---

## Flow 1: New Customer — Full Journey

Frame selection → Canva OAuth → design → export → checkout → payment → confirmation

1. User arrives at `/` (homepage)
2. Browses the frame grid; clicks "Design This Frame" on an A4 frame card
3. App checks Supabase Auth session → not logged in
4. User is redirected to `/login?next=/frames/a4-black-frame`
5. User signs up with email + password → Supabase creates account
6. User is redirected back to `/frames/a4-black-frame`
7. User clicks "Design Your Frame"
8. App checks `canva_tokens` table → no Canva token for this user
9. **[EXTERNAL]** App generates PKCE pair, stores `code_verifier` + `returnTo` in server session, redirects user to `https://www.canva.com/api/oauth/authorize?...`
10. **[FAILURE POINT]** User denies Canva permission on the OAuth consent screen
    - Recovery: Canva redirects to `/api/canva/callback?error=access_denied`; callback handler reads error param, redirects user to `/frames/a4-black-frame?error=canva_denied`; page shows "Canva permission is required to design. Please try again."
11. User grants permission → **[EXTERNAL]** Canva redirects to `/api/canva/callback?code=...&state=...`
12. Callback handler verifies `state` matches stored CSRF token
13. **[FAILURE POINT]** State mismatch (potential CSRF) or code already used
    - Recovery: redirect to `/frames/a4-black-frame?error=auth_failed` with error banner
14. **[EXTERNAL]** Callback handler exchanges code for tokens (`POST /rest/v1/oauth/token` on Canva)
15. Tokens upserted into `canva_tokens` table
16. **[EXTERNAL]** Callback handler calls `POST /rest/v1/designs` on Canva with A4 dimensions (2480×3508px)
17. **[FAILURE POINT]** Canva design creation fails (rate limit / API error)
    - Recovery: redirect to `/frames/a4-black-frame?error=design_failed`; user sees "Couldn't create design. Please try again." with a retry button
18. Callback handler stores `{ designId, frameId }` in server session, redirects user to `editUrl` from Canva response
19. **[EXTERNAL]** User is now at `https://www.canva.com/design/DAFxxxxxxx/edit` — designing in Canva
20. User finishes designing (no callback — Canva doesn't notify us)
21. User navigates back to the site or clicks a "Done designing" link (bookmarkable URL: `/design/DAFxxxxxxx?frameId=...`)
22. User lands on `/design/DAFxxxxxxx` — sees "Export My Design" button
23. User clicks "Export My Design"
24. App calls `POST /api/canva/export` → server creates export job
25. **[EXTERNAL]** Server polls `GET /rest/v1/exports/{exportId}` every 3 seconds (up to 20 attempts)
26. **[FAILURE POINT]** Export times out after 60 seconds (20 × 3s)
    - Recovery: show "Export is taking longer than expected. Try again?" button; the existing `exportId` is retried (not a new job) — see Flow 5
27. Export succeeds → server downloads PNG + PDF, uploads to Supabase Storage
28. **[FAILURE POINT]** Supabase Storage upload fails
    - Recovery: retry upload once; if still fails, show error "Couldn't save your design. Please try again." with retry button; design is NOT lost — the `designId` is still valid and can be re-exported
29. Page shows design preview (PNG signed URL from Supabase Storage)
30. User confirms design, clicks "Proceed to Checkout"
31. `{ designId, frameId, previewPath, printPath }` stored in sessionStorage, user navigates to `/checkout`
32. User fills in delivery address form
33. User clicks "Pay ₹{amount} via UPI"
34. App calls `POST /api/payments/create-order` with `frameId` → server reads price from `frames` table, creates Razorpay order
35. **[FAILURE POINT]** Razorpay order creation fails (network, Razorpay API down)
    - Recovery: inline error "Payment service unavailable. Please try again in a moment." — retry button
36. **[EXTERNAL]** Razorpay checkout modal opens in browser — user completes UPI payment
37. **[FAILURE POINT]** User closes the Razorpay modal without paying
    - Recovery: no action needed — modal closes, user stays on `/checkout`, can try again
38. **[FAILURE POINT]** UPI payment fails (insufficient balance, wrong UPI ID, bank timeout)
    - Recovery: Razorpay modal shows the failure inline; user can retry or use a different payment method within the modal
39. Payment succeeds → Razorpay calls webhook `POST /api/payments/webhook` (asynchronous)
40. Razorpay also returns `{ razorpayPaymentId, razorpaySignature }` to the client callback
41. Client calls `POST /api/payments/verify` with all three IDs + signature
42. Server verifies signature, confirms order exists in DB (created by webhook), returns `{ orderId }`
43. **[FAILURE POINT]** Verify returns 404 (webhook hasn't fired yet — race condition)
    - Recovery: client retries verify up to 5 times with 1-second delay; if still 404 after 5 retries, show "Payment received but order confirmation delayed — check My Orders in a minute" and redirect to `/orders`
44. Client redirects to `/orders/{orderId}/confirmation`
45. User sees order confirmation page with order ID ✓

---

## Flow 2: Returning Customer (Valid Canva Token)

Frame selection → design (no re-auth) → checkout → payment

1. Logged-in user at `/` clicks "Design This Frame" on a frame card
2. App checks `canva_tokens` — token exists and `expires_at` > now
3. Client calls `POST /api/canva/create-design` with `frameId`
4. Server uses stored access token to call `POST /rest/v1/designs`
5. **[FAILURE POINT]** Access token is expired (expires_at stale in DB or clock skew)
    - Recovery: server detects 401 from Canva, automatically calls `POST /rest/v1/oauth/token` with the refresh token, updates `canva_tokens` row, retries the design creation — transparent to the user
6. **[FAILURE POINT]** Refresh token is also invalid (user revoked app in Canva settings)
    - Recovery: server returns `{ requiresAuth: true, authUrl }` to client; client redirects user to Canva OAuth — full Flow 1 from step 9
7. Design created → redirect to Canva editor
8. User returns to `/design/[designId]`, exports, proceeds to checkout
9. Checkout and payment flow is identical to Flow 1 steps 31–45

---

## Flow 3: Payment Failure Recovery

1. User is in Razorpay modal, UPI payment is declined
2. Razorpay modal shows failure message inline (Razorpay handles this)
3. User can retry within the modal (different UPI ID, different bank) — up to Razorpay's retry logic
4. If user dismisses the modal: they return to `/checkout` with the form still filled in
5. The Razorpay order created in step 34 of Flow 1 is still valid for a short period
6. User clicks "Pay Again" → a **new** Razorpay order is created (previous one is abandoned — no charge occurred)
7. **[FAILURE POINT]** User paid but webhook was not received (Razorpay delivery failure)
    - Recovery: Razorpay retries webhook delivery for 24 hours with exponential backoff; `ON CONFLICT DO NOTHING` on the `orders` insert ensures idempotency. No duplicate orders are created.
8. If payment is stuck after 30 minutes: user contacts support via Instagram DM (v1 — no in-app support channel)

---

## Flow 4: Admin — View Orders → Update Status → Mark Shipped

1. Admin navigates to `/admin` (must be logged in with `role = 'admin'` in Supabase metadata)
2. **[FAILURE POINT]** Non-admin user tries to access `/admin`
    - Recovery: middleware detects `role !== 'admin'`, redirects to `/`
3. Admin sees order list, filtered to "Pending" by default
4. Clicks on an order row → navigates to `/admin/orders/[orderId]`
5. Admin reviews: customer name, address, design preview
6. Admin clicks "Download Print File" → `GET /api/admin/orders/[orderId]/download` returns a signed Supabase URL → PDF opens in new tab
7. **[FAILURE POINT]** Supabase Storage signed URL generation fails
    - Recovery: "Download failed. Try again." link — retries the same API call
8. Admin prints and dispatches the order physically
9. Admin returns to `/admin/orders/[orderId]`
10. Admin changes status dropdown from "Pending" to "Shipped"
11. Tracking number and courier fields become enabled
12. Admin enters tracking number (e.g., "1234567890") and courier ("Delhivery")
13. Admin clicks "Save Changes"
14. Client calls `PATCH /api/admin/orders/[orderId]` with `{ status: 'shipped', tracking_number: '...', courier: '...' }`
15. **[FAILURE POINT]** API call fails (network error, server error)
    - Recovery: show "Save failed. Try again." inline error; no optimistic update — state reverts to previous values
16. Success → order row updates; customer's `/orders/[orderId]` page now shows the tracking number on next load

---

## Flow 5: Canva Export Timeout

1. User clicks "Export My Design" on `/design/[designId]`
2. `POST /api/canva/export` creates export job, begins polling
3. Progress indicator shown: "Exporting your design… (attempt 8 of 20)"
4. After 20 polling attempts (60 seconds), export status is still `in_progress`
5. **[FAILURE POINT]** Export job timed out on the client wait
    - Note: the Canva export job itself may still be running — it hasn't necessarily failed
    - Recovery strategy A (preferred): the `exportId` is stored in state; a "Still waiting? Keep checking" button resumes polling the *same* export job for another 20 attempts (not creating a new one)
    - Recovery strategy B (if job status returns `failed`): show "Export failed. Would you like to try again?" which creates a new export job from the same `designId`
    - Recovery strategy C (user gives up): "Go back to Canva to re-save and try again" link — the design is not lost
6. **[FAILURE POINT]** Export completed on Canva but download URL expired before the server could download it (very rare)
    - Recovery: server detects a failed download, creates a new export job automatically (one silent retry), then returns the new download URL
7. If all retries fail: user is shown "Something went wrong exporting your design. Your design is saved in your Canva account — please try again in a few minutes."
