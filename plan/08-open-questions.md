# 08 — Open Questions

Every unresolved decision that must have an answer before or during the build. Ordered by how early in the build the answer is needed.

Format:
- **Context:** why this matters
- **Options:** possible answers
- **Recommended answer:** what to choose and why
- **Blocker?** YES = build cannot proceed past the noted phase without this answer
- **Owner:** who decides

---

### [Q-1] Canva API Access — Has the Integration Been Registered?

- **Context:** The Canva Connect API requires a registered integration to obtain a `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET`. Without these, Phase 3 cannot start. In development mode (pre-approval), only users explicitly allowlisted in the Canva Developer Portal can authenticate. To allow real customers to use the app, the integration must be submitted for and receive Canva's public integration approval (timeline: 2–8 weeks).
- **Options:**
  1. Register the integration now (before any code is written) to start the approval clock
  2. Register at the start of Phase 3
  3. Register after launch (not viable — users cannot authenticate without approval)
- **Recommended answer:** Register the integration immediately — today, before Phase 0 starts. Complete the Canva Developer Portal sign-up, create the integration, note the `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET`, and submit for public review as soon as a working demo (Phase 3 complete) is available. This is not a reason to delay the build — development can proceed using dev-mode with the business owner's Canva account on the allowlist.
- **Blocker?** YES — Phase 3 cannot start without `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET`. Public launch is blocked until approval is granted.
- **Owner:** Client (business owner) — must sign up at https://www.canva.com/developers/

---

### [Q-2] Canva Design Dimensions — Exact Pixel Sizes Per Frame

- **Context:** When creating a Canva design via `POST /rest/v1/designs`, exact pixel dimensions must be specified. These must match the physical print sizes at 300 DPI to produce print-ready output. The `frames` table stores `width_px` and `height_px` — these values must be confirmed before seeding the database (Phase 1).
- **Options (standard ISO sizes at 300 DPI):**
  | Frame | Width px | Height px |
  |---|---|---|
  | A3 | 3508 | 4961 |
  | A4 | 2480 | 3508 |
  | A5 | 1748 | 2480 |
  | Square 12×12" | 3600 | 3600 |
- **Recommended answer:** Use the ISO 300 DPI values above for standard sizes. For any non-standard or custom sizes the business sells, the client must provide exact physical dimensions (in mm) — the developer converts to pixels using: `px = round(mm / 25.4 * 300)`.
- **Blocker?** YES — Phase 1 (seed data) and Phase 3 (design creation) are blocked until all frame sizes and their pixel dimensions are confirmed.
- **Owner:** Client — must confirm the complete frame size catalogue and physical dimensions.

---

### [Q-3] Frame Catalogue — How Many Frames in V1?

- **Context:** The homepage is built around the frame catalogue. The number of frames, their names, descriptions, and pricing must be known before Phase 2 (homepage) can be completed.
- **Options:**
  1. 3 frames: A3, A4, A5 (standard poster sizes — simplest for v1)
  2. 5–6 frames: add Square 12×12", Landscape A4, and one premium large format
  3. Full catalogue (10+): all sizes from day one
- **Recommended answer:** Launch with 3–5 SKUs. More SKUs mean more Canva design dimension variants to test. A smaller, curated catalogue also makes the homepage cleaner. Add more after validating demand.
- **Blocker?** YES — Phase 1 seed data and Phase 2 homepage cannot be built without knowing the frame list and prices.
- **Owner:** Client — must provide: frame name, physical size (mm), price (₹), and whether it is active at launch.

---

### [Q-4] Razorpay Account — Test Mode Ready?

- **Context:** Phase 4 (payments) requires a Razorpay account with test credentials. The `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` must be available. Without these, the checkout flow cannot be built or tested.
- **Options:**
  1. Client already has a Razorpay account → retrieve test keys immediately
  2. Client needs to create an account → sign up at razorpay.com (requires Indian business/PAN details)
  3. Developer creates a test account → but the live keys must be the client's account for real payments
- **Recommended answer:** The client should create a Razorpay account now (if not already done) and share test API keys with the developer. Razorpay account creation requires KYC (PAN, business registration or personal PAN for freelancers). This can take 1–3 days for KYC approval. Start this process before Phase 4.
- **Blocker?** YES — Phase 4 is blocked without Razorpay credentials.
- **Owner:** Client — must create/share Razorpay account and generate test API keys.

---

### [Q-5] Admin Account — How Is the First Admin Created?

- **Context:** The admin role is stored in Supabase `user_metadata.role = 'admin'`. There is no self-registration path for admins (by design — only one admin in v1). Someone must manually set this on the first user.
- **Options:**
  1. Developer sets it via Supabase Dashboard (Table Editor → auth.users → edit metadata) during Phase 6
  2. Developer sets it via a one-time SQL query using the service role: `UPDATE auth.users SET raw_user_meta_data = '{"role":"admin"}'::jsonb WHERE email = 'admin@example.com'`
  3. Build a one-time CLI script that sets admin role on a specified email
- **Recommended answer:** Option 2 — one-time SQL via Supabase SQL editor. Simple, no extra code needed. Document the exact query in Phase 9 pre-launch checklist. The admin's Supabase email/password must be decided before Phase 6.
- **Blocker?** YES — Phase 6 cannot be verified without an admin account. Need the admin's email address.
- **Owner:** Client — must provide the email address to use for the admin account.

---

### [Q-6] Design File Retention — How Long Are Exports Kept?

- **Context:** Every order creates two files in Supabase Storage: a PNG preview and a print PDF. At launch, these are never deleted. Over time (at 500+ orders/month), storage costs will grow. Supabase Storage is priced per GB.
- **Options:**
  1. Keep all files permanently (simplest — no purge logic needed in v1)
  2. Purge files after 6 months (requires a scheduled job or Supabase Edge Function)
  3. Purge preview PNGs after 30 days, keep print PDFs permanently (compromise)
- **Recommended answer:** Keep all files permanently in v1 — the storage costs are negligible at launch volumes (see `plan/09-cost-breakdown.md`). Add a purge policy in v2 if storage costs become material. Do not build complexity now that isn't needed.
- **Blocker?** NO — a decision either way is fine for v1 build; the schema accommodates both.
- **Owner:** Developer decision (client to confirm acceptable).

---

### [Q-7] Domain and Hosting — Is a Domain Purchased?

- **Context:** The production `CANVA_REDIRECT_URI` must point to a real domain registered in the Canva Developer Portal. Vercel provides free hosting; the domain must be purchased and its DNS pointed to Vercel. The domain is also needed to register the production Canva integration.
- **Options:**
  1. Use an existing domain (e.g., posterx.in)
  2. Purchase a new domain (e.g., framers.in, designframes.in)
  3. Use a Vercel subdomain for launch (e.g., framers.vercel.app) — not recommended for Canva approval
- **Recommended answer:** A custom domain is strongly recommended. Canva's public integration review requires a legitimate-looking integration with a real domain, privacy policy, and terms of service. Purchase the domain before Phase 9 (ideally before Phase 3 so the Canva redirect URI is stable). Vercel is the recommended host (free tier, seamless Next.js deployment, automatic SSL).
- **Blocker?** YES (for production launch and Canva approval). The build can proceed on `localhost` for Phases 0–8.
- **Owner:** Client — must purchase domain and connect it to Vercel before Phase 9.

---

### [Q-8] Privacy Policy and Terms of Service — Who Writes Them?

- **Context:** Canva's public integration review requires a privacy policy URL and terms of service URL as part of the submission. Simple pages at `/privacy` and `/terms` are sufficient. These pages do not need legal counsel for a v1 indie product but must exist.
- **Options:**
  1. Developer writes minimal placeholder pages (2–3 paragraphs each)
  2. Client writes them or has them written
  3. Use a policy generator (e.g., Termly, PrivacyPolicies.com — free tier)
- **Recommended answer:** Use a free policy generator for speed. The policies need to accurately describe data collected (email, address, payment info via Razorpay, Canva designs). The developer can scaffold the pages in Phase 9; the client should review the content.
- **Blocker?** YES — Canva public integration review cannot be submitted without these URLs.
- **Owner:** Client (content) + Developer (page implementation).

---

### [Q-9] UPI Testing — Are Test UPI IDs Available?

- **Context:** Razorpay test mode provides test UPI IDs for simulating payments (e.g., `success@razorpay`, `failure@razorpay`). These must be used during Phase 4 testing. A live end-to-end payment test (₹1 real transaction) is required in Phase 9.
- **Options:** N/A — Razorpay's test UPI IDs are standard and available to any Razorpay test account.
- **Recommended answer:** Use Razorpay's documented test credentials during development. No client action needed for test mode. For Phase 9 live test: client should have a UPI-enabled bank account ready to make a ₹1 test payment.
- **Blocker?** NO — test credentials are standard. Live test requires client's UPI account (minor).
- **Owner:** Developer for test mode; Client for live test.

---

### [Q-10] Poster Sample Images — Which Images to Use on Frame Detail Pages?

- **Context:** The `/frames/[slug]` detail page shows sample poster images in the frame to help customers visualise the product. 24 poster JPGs exist in `/posterx_posters/`. It's unclear which images to use for which frame sizes, or how many to show per frame.
- **Options:**
  1. Show the same 3–4 curated images on all frame detail pages
  2. Assign specific images to specific frame categories (car frames, bike frames, custom frames)
  3. Show all 24 in a scrollable carousel on every frame page
- **Recommended answer:** Show 4–6 curated images per frame detail page. Assign by content type once the client confirms which images are their best work. For now, the carousel component accepts any image array — the curation is a content decision, not a technical one.
- **Blocker?** NO — a placeholder or all-images fallback works for development; final curation can happen in Phase 7.
- **Owner:** Client — curate 4–6 favourite poster images per frame type.
