# 01 — Canva API Reality Check

This document records what the Canva Connect API v1 *actually* supports, what it cannot do, and where the planned user flow may run into hard walls. Read this before writing any Canva-related code.

---

## What Canva Connect API v1 Actually Supports

The Connect API is a REST API (`https://api.canva.com/rest/v1/`) that lets external applications create and manage Canva designs on behalf of authenticated users. It is separate from the Canva Apps SDK (which runs *inside* the Canva editor sidebar).

### Available Operations

| Operation | Endpoint | Notes |
|---|---|---|
| Initiate OAuth flow | Redirect to `https://www.canva.com/api/oauth/authorize` | PKCE required |
| Exchange code for tokens | `POST https://api.canva.com/rest/v1/oauth/token` | Returns access + refresh tokens |
| Refresh access token | `POST https://api.canva.com/rest/v1/oauth/token` (grant_type=refresh_token) | |
| Create a design | `POST /rest/v1/designs` | Can specify dimensions or design type |
| Get design metadata | `GET /rest/v1/designs/{designId}` | Returns title, thumbnail, edit URL |
| List user's designs | `GET /rest/v1/designs` | Paginated |
| Create export job | `POST /rest/v1/exports` | Async — returns a job ID |
| Poll export status | `GET /rest/v1/exports/{exportId}` | Poll until status = `success` |
| Get asset (upload) | `POST /rest/v1/assets` | Upload images to user's Canva account |

### Supported Export Formats

`PNG` · `JPG` · `PDF_PRINT` (print-ready with bleed) · `PPTX` · `MP4` (for animated designs)

For this project: export as **`PDF_PRINT`** for the print file sent to the print shop, and **`PNG`** for the design preview shown to the customer.

---

## OAuth 2.0 Flow — Required Scopes

Canva uses OAuth 2.0 with **PKCE (Proof Key for Code Exchange)**. A client secret alone is not sufficient; the `code_verifier` / `code_challenge` pair must be generated per-session.

### Scopes Needed for This Project

| Scope | Why It's Needed |
|---|---|
| `design:content:read` | Read design metadata and thumbnails |
| `design:content:write` | Create new designs with preset dimensions |
| `design:meta:read` | Read design title, edit URL |
| `asset:read` | Read assets (needed for some export flows) |
| `profile:read` | Read the user's Canva profile (for token validation) |

Scopes are space-separated in the authorization URL. Request only what is needed — Canva reviewers check for scope minimalism.

### Authorization URL Shape

```
https://www.canva.com/api/oauth/authorize
  ?client_id=YOUR_CLIENT_ID
  &response_type=code
  &redirect_uri=https://yoursite.com/api/canva/callback
  &scope=design:content:read%20design:content:write%20design:meta:read%20profile:read
  &code_challenge=BASE64URL(SHA256(code_verifier))
  &code_challenge_method=S256
  &state=CSRF_TOKEN
```

### Token Storage

- **Access token:** short-lived (~4 hours). Store in the `canva_tokens` Supabase table.
- **Refresh token:** long-lived (no documented expiry, but treat as potentially revocable). Store encrypted in the same table.
- Tokens are **per user** — each customer has their own Canva OAuth session.
- The `state` parameter must be a random, per-request CSRF token verified on callback.

---

## Creating a Design with Preset Dimensions

`POST /rest/v1/designs`

```json
{
  "design_type": {
    "type": "custom",
    "width": 2480,
    "height": 3508
  },
  "title": "My A4 Frame Design"
}
```

Dimensions are in **pixels at 96 DPI** for screen, but for print use **300 DPI equivalents**:

| Frame Size | Width px (300 DPI) | Height px (300 DPI) |
|---|---|---|
| A3 | 3508 | 4961 |
| A4 | 2480 | 3508 |
| A5 | 1748 | 2480 |
| Square 12×12" | 3600 | 3600 |

These dimensions must be confirmed with the client and stored in the `frames` table — see `plan/03-supabase-schema.md`.

The API response includes:
```json
{
  "design": {
    "id": "DAFxxxxxxx",
    "title": "My A4 Frame Design",
    "urls": {
      "edit_url": "https://www.canva.com/design/DAFxxxxxxx/edit",
      "view_url": "https://www.canva.com/design/DAFxxxxxxx/view"
    }
  }
}
```

The `edit_url` is what the user is redirected to. **Store the `design.id` in the session or database immediately** — it is needed to trigger the export later.

---

## Design Export — How It Works

Export is **asynchronous**. There is no webhook; the client must poll.

### Step 1 — Create an Export Job

`POST /rest/v1/exports`

```json
{
  "design_id": "DAFxxxxxxx",
  "format": {
    "type": "pdf",
    "export_quality": "print"
  }
}
```

Response:
```json
{
  "job": {
    "id": "EXPxxxxxxx",
    "status": "in_progress"
  }
}
```

### Step 2 — Poll for Completion

`GET /rest/v1/exports/EXPxxxxxxx`

Poll every **3 seconds**, up to **20 attempts** (60 seconds total). Typical export: 5–30 seconds.

Terminal statuses:
- `success` — `job.urls` array contains the download URL(s)
- `failed` — surface an error to the user; offer a retry

On `success`:
```json
{
  "job": {
    "id": "EXPxxxxxxx",
    "status": "success",
    "urls": [
      "https://export.canva.com/...?X-Amz-Signature=..."
    ]
  }
}
```

The export URL is **time-limited** (typically 1 hour). Download the file immediately and upload it to Supabase Storage — do not store the Canva URL as a permanent reference.

---

## Editor Redirect URL Pattern

After creating a design, redirect the user to:

```
https://www.canva.com/design/{designId}/edit
```

This opens the Canva editor on the user's Canva account (they must be logged in to Canva). The user designs freely, then navigates back to the application.

**There is no callback or webhook when the user finishes editing.** The application cannot know when the user is "done." The UX solution: when the user returns to the app, they click a "Done — Export My Design" button which triggers the export job.

---

## API Access Requirements — The Approval Blocker

### Development Mode (Immediate, No Approval)

- Register an integration at `https://www.canva.com/developers/`
- In development mode, only **users explicitly added to the allowlist** (Canva team members, up to ~25) can authenticate
- Sufficient for building and testing the full flow

### Production Mode (Requires Canva Review)

- Submit for public integration review via the Canva Developer Portal
- Canva manually reviews: UI, privacy policy, terms of service, security practices
- **Timeline: 2–8 weeks** (variable; no SLA)
- **This is a hard launch blocker.** See `plan/08-open-questions.md` Q-1.
- Apply as early as possible — submit alongside or immediately after completing Phase 3 of the build.

### Enterprise (NOT Required)

Private integrations (single-team only) require Canva Enterprise (~USD $30/user/month). This project needs a **public integration** (any user can authenticate), which goes through review rather than requiring Enterprise.

---

## Known Limitations

| Limitation | Impact on This Project |
|---|---|
| **No iframe embedding** | The editor CANNOT be embedded in the site. Users must be redirected to canva.com. This is a fundamental UX constraint — plan the flow accordingly. | 
| **No editor close callback** | Cannot detect when the user finishes designing. Use a manual "Done designing" CTA. |
| **Export URL is time-limited** | Must download and store in Supabase Storage immediately after export. |
| **Polling-only for exports** | No webhooks. Must implement server-side polling loop in a Next.js API route. |
| **Tokens are per-user** | Each customer has their own OAuth session. The app cannot use a single service account to export designs on behalf of users — each export must use the user's own access token. |
| **Rate limits** | Canva enforces rate limits (not publicly documented with exact numbers). Implement exponential backoff on polling. Do not export more than one design per user per second. |
| **Design ownership** | The design belongs to the user's Canva account, not the application. Users can edit or delete designs from inside Canva. Store the exported file in Supabase Storage — do not rely on Canva as permanent storage. |

---

## Flags — Parts of the Planned Flow the API May NOT Support

| Risk | Severity | Mitigation |
|---|---|---|
| **Approval timeline blocks launch** | HIGH | Apply for review on Day 1 of development. Test in dev mode throughout. Prepare a WooCommerce fallback if approval is delayed past the target launch date. |
| **User deletes their Canva account or revokes app permission** | MEDIUM | On export failure with 401/403, prompt re-authentication. Do not assume tokens are permanent. |
| **Export takes > 60 seconds** | LOW | Implement a timeout with a user-friendly retry prompt. Log the `exportId` so a retry can poll the same job rather than creating a new one. |
| **Canva changes undocumented API behaviour** | LOW | Pin integration to documented v1 endpoints only. Subscribe to Canva developer changelog. |
