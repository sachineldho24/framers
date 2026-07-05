# Canva Connect API — Complete Reference Documentation

> **Source:** Compiled directly from `canva.dev/docs/connect` (June 2025)  
> **GitHub Starter Kit:** https://github.com/canva-sdks/canva-connect-api-starter-kit  
> **OpenAPI Spec:** https://www.canva.dev/sources/connect/api/latest/api.yml

---

## Table of Contents

1. [Overview](#1-overview)
2. [Public vs. Private Integrations](#2-public-vs-private-integrations)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Creating an Integration (Developer Portal)](#4-creating-an-integration-developer-portal)
5. [Authentication — OAuth 2.0 + PKCE](#5-authentication--oauth-20--pkce)
6. [API Requests & Responses](#6-api-requests--responses)
7. [Scopes Reference](#7-scopes-reference)
8. [Designs API](#8-designs-api)
9. [Assets API](#9-assets-api)
10. [Exports API](#10-exports-api)
11. [Autofill API (Enterprise)](#11-autofill-api-enterprise)
12. [Return Navigation Guide](#12-return-navigation-guide)
13. [Error Handling](#13-error-handling)
14. [Security Recommendations](#14-security-recommendations)
15. [Submission Checklist (Public Integrations)](#15-submission-checklist-public-integrations)
16. [Canva Dev MCP Server (Claude Code / Cursor)](#16-canva-dev-mcp-server-claude-code--cursor)
17. [TypeScript SDK — Generating from OpenAPI](#17-typescript-sdk--generating-from-openapi)
18. [Quickstart — Running the Starter Kit Locally](#18-quickstart--running-the-starter-kit-locally)
19. [Asynchronous Job Polling Pattern](#19-asynchronous-job-polling-pattern)
20. [Trial Quotas (Preview)](#20-trial-quotas-preview)
21. [Key Limitations & Critical Notes](#21-key-limitations--critical-notes)

---

## 1. Overview

The **Canva Connect APIs** are RESTful interfaces that let you integrate Canva's design capabilities into your own web apps and platforms.

**What you can build with Connect APIs:**
- Upload assets to Canva and sync them programmatically
- Create designs programmatically with preset dimensions
- Send users to the Canva editor to design, then redirect them back to your app
- Export finished designs as PNG/PDF back to your system
- Autofill brand templates with dynamic data (Enterprise only)
- Sync comments, manage folders, and resize designs

**Base API URL:**
```
https://api.canva.com/rest/v1/
```

**OAuth / Authorization URL:**
```
https://www.canva.com/api/oauth/authorize
```

**Token Endpoint:**
```
https://api.canva.com/rest/v1/oauth/token
```

---

## 2. Public vs. Private Integrations

| Type | Availability | Review Required | Enterprise Needed |
|------|-------------|-----------------|-------------------|
| **Public** | All Canva users worldwide | ✅ Yes — Canva review process | ❌ No (for basic APIs) |
| **Private** | Your team only | ❌ No | ✅ Yes — Canva Enterprise plan |

> **For your print-on-demand project:** Start with a **Public** integration. No Enterprise plan is needed for the core flow (OAuth → create design → redirect to editor → export).
> The **Autofill API** (brand template pre-filling) requires Enterprise. Not needed for v1.

---

## 3. Prerequisites & Setup

### Account Requirements
- A Canva account (free tier is fine for Public integrations)
- **Multi-Factor Authentication (MFA) must be enabled** on your Canva account before you can create an integration
  - Enable at: `https://www.canva.com/help/login-verification/`

### Development Environment
```bash
# Required versions (from Canva's .nvmrc)
node --version   # v24+
npm --version    # v11+
git --version    # any recent version
```

Use `nvm` to manage Node versions:
```bash
nvm install      # auto-reads .nvmrc in starter kit root
```

---

## 4. Creating an Integration (Developer Portal)

### Step 1 — Create the Integration

1. Log in to [https://www.canva.com/developers/](https://www.canva.com/developers/)
2. Go to **Your integrations** → Click **Create an integration**
3. Choose **Public** (available to all users, requires review) or **Private** (team-only, Enterprise required)
4. Agree to [Canva Developer Terms](https://www.canva.com/policies/canva-developer-terms/)
5. Click **Create integration**

### Step 2 — Get Credentials

On the **Configure your integration** page:

| Item | Action |
|------|--------|
| **Integration name** | Set a user-facing name (shown during OAuth) |
| **Client ID** | Copy and save — used in all OAuth requests |
| **Client secret** | Click **Generate secret** — **save immediately, can't view again** |

> ⚠️ **Critical:** The client secret is shown only once. Store it in a secrets manager or `.env` file immediately.

### Step 3 — Set Scopes

Navigate to **Scopes** in the left menu. For a print-on-demand design flow, select:

```
design:content:read
design:content:write
design:meta:read
asset:read
asset:write
profile:read
```

> Only select scopes you actually use. Public integrations require scope justification during review.

### Step 4 — Set Redirect URL

Navigate to **Authentication** → **Authorized redirects**.

```
# Local development (localhost NOT allowed — use 127.0.0.1):
http://127.0.0.1:3001/oauth/redirect

# Production:
https://yourdomain.com/api/canva/callback
```

Add up to 10 redirect URLs. Remove local URLs before submitting for public review.

### Step 5 — Enable Return Navigation (Optional but Recommended)

Navigate to **Return navigation** → Enable toggle → Set Return URL:

```
# Local:
http://127.0.0.1:3001/return-nav

# Production:
https://yourdomain.com/api/canva/return
```

This powers the **"Done" / "Return to [your app]"** button inside the Canva editor, so users can come back to your checkout page after designing.

---

## 5. Authentication — OAuth 2.0 + PKCE

Canva uses **OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange)** using **SHA-256**.

### Full Flow Diagram

```
Your App                    Canva
   |                           |
   |--- Generate code_verifier + code_challenge (PKCE) ---|
   |                           |
   |--- Redirect user to authorization URL --------------->|
   |                           |
   |<-- User approves, redirect back with ?code=... -------|
   |                           |
   |--- POST /oauth/token (code + code_verifier) -------->|
   |                           |
   |<-- access_token + refresh_token --------------------- |
   |                           |
   |--- GET/POST /rest/v1/... (Bearer token) ------------>|
   |<-- API response ----------------------------------------|
```

---

### Step 1 — Generate PKCE Strings

```js
import crypto from "crypto";

// Generate code_verifier (43–128 chars, high-entropy, URL-safe)
const codeVerifier = crypto.randomBytes(96).toString("base64url");

// Generate code_challenge = SHA-256(code_verifier), base64url-encoded
const codeChallenge = crypto
  .createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

// Generate state (CSRF protection, unique per request)
const state = crypto.randomBytes(96).toString("base64url");
```

> ⚠️ **Store `codeVerifier` server-side (e.g. session/cookie). Never expose it to the browser.**  
> ⚠️ **`state` must NOT be used to store `codeVerifier`.**  
> Both must be unique per request.

---

### Step 2 — Build the Authorization URL

```
https://www.canva.com/api/oauth/authorize
  ?code_challenge=<code_challenge>
  &code_challenge_method=S256
  &scope=design:content:read%20design:content:write%20design:meta:read%20asset:read%20asset:write
  &response_type=code
  &client_id=<YOUR_CLIENT_ID>
  &state=<state>
  &redirect_uri=https://yourdomain.com/api/canva/callback
```

**Parameters:**

| Parameter | Required | Value |
|-----------|----------|-------|
| `code_challenge` | ✅ | SHA-256 hash of `code_verifier`, base64url-encoded |
| `code_challenge_method` | ✅ | Must be `S256` |
| `scope` | ✅ | Space-separated list of scopes (URL-encoded as `%20`) |
| `response_type` | ✅ | Must be `code` |
| `client_id` | ✅ | Your integration's Client ID |
| `state` | Recommended | High-entropy random string for CSRF protection |
| `redirect_uri` | Optional if only 1 set | Must match a pre-registered redirect URL |

---

### Step 3 — Handle the Callback

After user approves, Canva redirects to:

```
https://yourdomain.com/api/canva/callback?code=AUTH_CODE&state=STATE_VALUE
```

**Validate the state** before proceeding:

```ts
// Next.js App Router — app/api/canva/callback/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");

  // CRITICAL: Verify state matches what you stored
  const storedState = /* retrieve from server-side session */ "";
  if (returnedState !== storedState) {
    return NextResponse.json({ error: "State mismatch — possible CSRF" }, { status: 400 });
  }

  // Exchange code for tokens (next step)
  const tokens = await exchangeCodeForTokens(code!);
  // Store tokens securely, redirect user
}
```

---

### Step 4 — Exchange Code for Access Token

**Endpoint:** `POST https://api.canva.com/rest/v1/oauth/token`

> ⚠️ This request **must come from your backend**. It will be blocked by Canva's CORS policy if made from the browser.

**Using Basic Auth (recommended):**

```bash
# credentials = base64("client_id:client_secret")
curl --request POST 'https://api.canva.com/rest/v1/oauth/token' \
  --header 'Authorization: Basic <base64(client_id:client_secret)>' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode 'code_verifier=<code_verifier>' \
  --data-urlencode 'code=<authorization_code>' \
  --data-urlencode 'redirect_uri=https://yourdomain.com/api/canva/callback'
```

**TypeScript implementation:**

```ts
async function exchangeCodeForTokens(code: string, codeVerifier: string) {
  const credentials = Buffer.from(
    `${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
      code: code,
      redirect_uri: process.env.CANVA_REDIRECT_URI!,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.message}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;   // seconds
    token_type: "bearer";
    scope: string;
  }>;
}
```

**Success Response:**

```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 3600,
  "scope": "design:content:read design:content:write",
  "refresh_token": "eyJhbGci..."
}
```

---

### Step 5 — Refresh an Expired Token

Access tokens expire. Use the refresh token to get a new one without re-authorizing the user.

> ⚠️ Each refresh token can only be used **once**. Store the new refresh token from each response.

```ts
async function refreshAccessToken(refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  return response.json() as Promise<{
    access_token: string;
    refresh_token: string;   // NEW refresh token — save this
    expires_in: number;
    token_type: "bearer";
  }>;
}
```

---

### Step 6 — Introspect a Token (Validate)

```bash
POST https://api.canva.com/rest/v1/oauth/introspect
```

```ts
async function introspectToken(token: string) {
  const credentials = Buffer.from(
    `${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.canva.com/rest/v1/oauth/introspect", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  });

  return response.json();
  // Returns: { active: true/false, scope, exp, sub, ... }
}
```

---

### Step 7 — Revoke a Token

```ts
async function revokeToken(token: string) {
  const credentials = Buffer.from(
    `${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`
  ).toString("base64");

  await fetch("https://api.canva.com/rest/v1/oauth/revoke", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  });
}
```

---

## 6. API Requests & Responses

### Making Authenticated Requests

All Connect API calls require a Bearer token:

```bash
curl --request GET \
  --url https://api.canva.com/rest/v1/designs \
  --header 'Authorization: Bearer <access_token>'
```

```ts
async function canvaGet(endpoint: string, accessToken: string) {
  const response = await fetch(`https://api.canva.com/rest/v1${endpoint}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Canva API error: ${error.code} — ${error.message}`);
  }

  return response.json();
}
```

### HTTP Methods Used

| Method | Purpose |
|--------|---------|
| `GET` | Read resources |
| `POST` | Create resources or trigger jobs |
| `PUT` | Replace a resource |
| `PATCH` | Partially update a resource |
| `DELETE` | Delete a resource |

### Path Parameters

```bash
# Example: get a specific folder
GET https://api.canva.com/rest/v1/folders/{folderId}
```

### Query Parameters

```bash
# Example: list designs with pagination
GET https://api.canva.com/rest/v1/designs?continuation=TOKEN&limit=20
```

### Response Structure

**Success (2xx):**
```json
{
  "job": { ... }
}
```

**Error (4xx/5xx):**
```json
{
  "code": "design_not_found",
  "message": "Design with id 'ABCD' not found"
}
```

---

## 7. Scopes Reference

| Scope | What It Allows |
|-------|---------------|
| `asset:read` | View metadata of user's uploaded assets |
| `asset:write` | Upload, update, or delete assets |
| `brandtemplate:content:read` | Read brand template content (Enterprise) |
| `brandtemplate:content:write` | Publish brand templates (Enterprise) |
| `brandtemplate:meta:read` | View brand template metadata (Enterprise) |
| `collaboration:event` | Receive webhook notifications |
| `comment:read` | View design comments |
| `comment:write` | Create comments and replies |
| `design:content:read` | View design content |
| `design:content:write` | **Create designs on user's behalf** ← core scope |
| `design:meta:read` | **View design metadata, edit/view URLs** ← core scope |
| `email` | Read user email via OIDC |
| `folder:permission:write` | Set/update/remove folder permissions |
| `folder:read` | View folder metadata and contents |
| `folder:write` | Add/move/remove folders |
| `openid` | Read user info via OIDC |
| `profile` | Read user profile via OIDC |
| `profile:read` | Read user profile and account info |

> **Minimum scopes for print-on-demand flow:**
> ```
> design:content:write design:meta:read asset:read asset:write profile:read
> ```

> **Note:** Scopes are NOT hierarchical. `asset:write` does NOT include `asset:read`. You must request both explicitly.

---

## 8. Designs API

### Create a Design

```bash
POST https://api.canva.com/rest/v1/designs
```

```ts
interface CreateDesignRequest {
  asset_id?: string;         // Create from existing asset
  title?: string;            // Design name
  design_type?: {
    type: "preset";
    name: string;            // e.g. "A4Document", "Poster", "SocialMedia"
  } | {
    type: "custom";
    width: number;           // px
    height: number;          // px
  };
}

async function createDesign(
  accessToken: string,
  widthPx: number,
  heightPx: number,
  title: string
) {
  const response = await fetch("https://api.canva.com/rest/v1/designs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      design_type: {
        type: "custom",
        width: widthPx,
        height: heightPx,
      },
    }),
  });

  const data = await response.json();
  return data.design as {
    id: string;
    title: string;
    urls: {
      edit_url: string;   // Redirect user to this URL to open Canva editor
      view_url: string;
    };
    thumbnail: {
      width: number;
      height: number;
      url: string;
    };
    owner: {
      user_id: string;
      team_id: string;
    };
    created_at: number;
    updated_at: number;
  };
}
```

**Example response:**
```json
{
  "design": {
    "id": "DABcDeFgHiJ",
    "title": "A4 Frame Design",
    "urls": {
      "edit_url": "https://www.canva.com/api/design/{token}/edit",
      "view_url": "https://www.canva.com/api/design/{token}/view"
    },
    "thumbnail": {
      "width": 595,
      "height": 842,
      "url": "https://export-download.canva.com/..."
    },
    "owner": {
      "user_id": "UABcDe123",
      "team_id": "TABcDe123"
    },
    "created_at": 1718000000,
    "updated_at": 1718000000
  }
}
```

---

### List Designs

```bash
GET https://api.canva.com/rest/v1/designs
```

```ts
async function listDesigns(accessToken: string, continuation?: string) {
  const url = new URL("https://api.canva.com/rest/v1/designs");
  if (continuation) url.searchParams.set("continuation", continuation);

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return response.json() as Promise<{
    continuation?: string;   // Pagination cursor for next page
    items: Array<{
      id: string;
      title: string;
      doctype_name: string;  // e.g. "1920px x 1920px"
      thumbnail: { width: number; height: number; url: string };
      urls: { edit_url: string; view_url: string };
      owner: { user_id: string; team_id: string };
    }>;
  }>;
}
```

---

### Get a Design

```bash
GET https://api.canva.com/rest/v1/designs/{designId}
```

---

## 9. Assets API

### Upload an Asset

Assets must be uploaded before they can be used in autofill or other design operations.

**This is an asynchronous job.** See [Section 19](#19-asynchronous-job-polling-pattern) for the polling pattern.

```bash
POST https://api.canva.com/rest/v1/asset-uploads
```

```ts
async function uploadAsset(accessToken: string, fileBuffer: Buffer, fileName: string) {
  // Asset-Upload-Metadata requires the filename base64-encoded
  const nameBase64 = Buffer.from(fileName).toString("base64");

  const response = await fetch("https://api.canva.com/rest/v1/asset-uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: nameBase64 }),
    },
    body: fileBuffer,
  });

  return response.json() as Promise<{
    job: {
      id: string;
      status: "in_progress" | "success" | "failed";
    };
  }>;
}
```

### Get Asset Upload Job

```bash
GET https://api.canva.com/rest/v1/asset-uploads/{jobId}
```

```ts
async function getAssetUploadJob(accessToken: string, jobId: string) {
  const response = await fetch(
    `https://api.canva.com/rest/v1/asset-uploads/${jobId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.json() as Promise<{
    job: {
      id: string;
      status: "in_progress" | "success" | "failed";
      asset?: {
        id: string;
        type: "image" | "video";
        name: string;
      };
      error?: { code: string; message: string };
    };
  }>;
}
```

**Limitations:**
- Only **image assets** can be used for Autofill. Video not supported.
- External image URLs are not directly supported — upload via URL using `POST /rest/v1/asset-uploads/url`.

---

## 10. Exports API

After a user finishes designing in Canva, export the design to get a downloadable file.

**This is an asynchronous job.** Initiate, then poll.

### Create an Export Job

```bash
POST https://api.canva.com/rest/v1/exports
```

```ts
type ExportFormat = "PNG" | "JPG" | "PDF_STANDARD" | "PDF_PRINT" | "SVG" | "GIF" | "MP4" | "PPTX";

async function createExportJob(
  accessToken: string,
  designId: string,
  format: ExportFormat = "PNG"
) {
  const response = await fetch("https://api.canva.com/rest/v1/exports", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      design_id: designId,
      format: format,
      // For PDF_PRINT: high quality suitable for physical printing
      // For PNG: lossless, transparent backgrounds supported
    }),
  });

  return response.json() as Promise<{
    job: {
      id: string;
      status: "in_progress";
    };
  }>;
}
```

### Get Export Job Status

```bash
GET https://api.canva.com/rest/v1/exports/{exportId}
```

```ts
async function getExportJob(accessToken: string, exportId: string) {
  const response = await fetch(
    `https://api.canva.com/rest/v1/exports/${exportId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.json() as Promise<{
    job: {
      id: string;
      status: "in_progress" | "success" | "failed";
      result?: {
        type: "export_design";
        urls: string[];      // Download URLs for exported files
      };
      error?: { code: string; message: string };
    };
  }>;
}
```

### Full Export Workflow (TypeScript)

```ts
async function exportDesignAndDownload(
  accessToken: string,
  designId: string,
  format: ExportFormat = "PDF_PRINT"
): Promise<string[]> {
  // 1. Create export job
  const { job } = await createExportJob(accessToken, designId, format);

  // 2. Poll with exponential backoff until done
  const downloadUrls = await pollWithBackoff(
    () => getExportJob(accessToken, job.id),
    (result) => result.job.status !== "in_progress",
    { initialDelayMs: 1000, maxDelayMs: 10000, maxAttempts: 30 }
  );

  if (downloadUrls.job.status === "failed") {
    throw new Error(`Export failed: ${downloadUrls.job.error?.message}`);
  }

  return downloadUrls.job.result!.urls;
}
```

---

## 11. Autofill API (Enterprise)

> ⚠️ **Requires Canva Enterprise.** Both the developer account AND every user account must be on Enterprise. Not needed for the basic "create design → user edits → export" flow.

### What Autofill Does

Autofill lets you populate a **Brand Template** (a Canva template with named data fields) with dynamic data (text, images) to generate a new design automatically — without the user having to manually edit anything.

**Use case for print-on-demand:** Pre-fill a poster template with a customer's name or photo before they open the editor to make final tweaks.

### Required Scopes

```
design:content:read
design:content:write
design:meta:read
brandtemplate:meta:read
brandtemplate:content:read
asset:read
asset:write
```

### Step 1 — Get Brand Template Dataset

```bash
GET https://api.canva.com/rest/v1/brand-templates/{templateId}/dataset
```

```ts
async function getBrandTemplateDataset(accessToken: string, templateId: string) {
  const response = await fetch(
    `https://api.canva.com/rest/v1/brand-templates/${templateId}/dataset`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  return response.json() as Promise<{
    dataset: Record<string, { type: "text" | "image" }>;
  }>;
}
// Example response dataset:
// { "CUSTOMER_NAME": { "type": "text" }, "PHOTO": { "type": "image" } }
```

### Step 2 — Create Autofill Job

```bash
POST https://api.canva.com/rest/v1/autofills
```

```ts
async function createAutofillJob(
  accessToken: string,
  templateId: string,
  data: Record<string, { type: "text"; text: string } | { type: "image"; asset_id: string }>
) {
  const response = await fetch("https://api.canva.com/rest/v1/autofills", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      brand_template_id: templateId,
      data,
    }),
  });

  return response.json();
}

// Usage example:
const job = await createAutofillJob(accessToken, "AEN3TrQftXo", {
  CITY: { type: "text", text: "Mumbai" },
  TEMPERATURE: { type: "text", text: "32°C" },
  BACKGROUND: { type: "image", asset_id: "Msd59349ff" },
});
```

### Step 3 — Poll Autofill Job

```bash
GET https://api.canva.com/rest/v1/autofills/{jobId}
```

Success response:
```json
{
  "job": {
    "id": "a71ef223-...",
    "status": "success",
    "result": {
      "type": "create_design",
      "design": {
        "url": "https://www.canva.com/design/{DESIGN-ID}/edit",
        "thumbnail": {
          "url": "https://export-download.canva.com/..."
        }
      }
    }
  }
}
```

---

## 12. Return Navigation Guide

This is the **core flow** for your print-on-demand site. It lets users go from your site → Canva editor → back to your checkout with one click.

### Full Workflow

```
1. Your site → creates a design via API → gets edit_url
2. You append correlation_state to the edit_url
3. User clicks "Design in Canva" → opens canva.com/api/design/{token}/edit
4. User designs in Canva, clicks "Done" / "Return to [Your App]" button
5. Canva redirects to your return URL with ?correlation_jwt=...
6. You decode + validate the JWT → extract design_id + correlation_state
7. Use design_id to trigger export → get file → send user to checkout
```

---

### Step 1 — Create Design & Build Edit URL

```ts
// After creating a design (Section 8), append correlation_state to edit_url
const design = await createDesign(accessToken, 2480, 3508, "A4 Frame Design");

// correlation_state: max 50 chars, URL-safe, stores your app state
// Best practice: store actual state in DB, use a short key here
const correlationState = `order_${orderId}_frame_${frameId}`;
// or store in Supabase and use a UUID key: const correlationState = sessionKey;

const editUrl = `${design.urls.edit_url}?correlation_state=${encodeURIComponent(correlationState)}`;

// Optional: open a specific Canva App when editor loads
// const editUrl = `${design.urls.edit_url}?correlation_state=${correlationState}&app_id=${APP_ID}`;

// Redirect user to this URL
redirect(editUrl);
```

> **correlation_state requirements:**
> - Max 50 characters
> - Must be URL-safe (base64url recommended)
> - Can contain stringified JSON if under 50 chars
> - If you need more data, store it in your DB and use a short lookup key

---

### Step 2 — Configure Return URL in Developer Portal

In the Developer Portal:
1. Go to **Return navigation**
2. Enable the toggle
3. Set your return URL (e.g. `https://yourdomain.com/api/canva/return`)

The Canva editor will show a **"Return to [Your Integration Name]"** button:

```
https://www.canva.com/design/{token}/edit
                        ↑
              User designs here, then clicks "Return"
                        ↓
https://yourdomain.com/api/canva/return?correlation_jwt=JWT_TOKEN
```

---

### Step 3 — Parse and Validate the Return JWT

```bash
# Install jose for JWT verification
npm install jose
```

```ts
// app/api/canva/return/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";

const CANVA_JWKS_URL = "https://api.canva.com/rest/v1/connect/keys";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const correlationJwt = searchParams.get("correlation_jwt");

  if (!correlationJwt) {
    return NextResponse.redirect("/error?msg=missing_jwt");
  }

  try {
    // Fetch Canva's public keys and verify the JWT
    const JWKS = jose.createRemoteJWKSet(new URL(CANVA_JWKS_URL));

    const { payload } = await jose.jwtVerify(correlationJwt, JWKS, {
      audience: process.env.CANVA_CLIENT_ID!,
    });

    // Validate payload fields
    if (payload.type !== "rti") {
      return NextResponse.redirect("/error?msg=invalid_jwt_type");
    }

    const designId = payload.design_id as string;
    const correlationState = payload.correlation_state as string;
    const userId = payload.sub as string;
    const teamId = payload.team_id as string;
    // payload.exp = expiry (1 day after design was opened)
    // payload.jti = unique JWT ID

    // Use correlationState to look up your app state (e.g. orderId, frameId)
    // Then trigger export and redirect to checkout
    const redirectUrl = `/checkout?designId=${designId}&state=${correlationState}`;
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error("JWT verification failed:", error);
    return NextResponse.redirect("/error?msg=invalid_jwt");
  }
}
```

**JWT Payload Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `aud` | string | Your integration's Client ID |
| `exp` | number | Token expiry (1 day after design opened) |
| `sub` | string | User ID of the returning user |
| `team_id` | string | Team ID of the returning user |
| `type` | string | Always `"rti"` (return to integration) |
| `jti` | string | Unique JWT identifier |
| `design_id` | string | The Canva design ID |
| `correlation_state` | string | Your original `correlation_state` value |

---

## 13. Error Handling

### Error Response Format

```json
{
  "code": "invalid_access_token",
  "message": "Access token is invalid"
}
```

### All Error Codes

```
internal_error          invalid_field           invalid_header_value
permission_denied       too_many_requests       not_found
bad_request_body        bad_http_method         bad_request_params
bad_query_params        user_role_required      endpoint_not_found
endpoint_gone           unsupported_version     invalid_access_token
revoked_access_token    missing_field           missing_scope
invalid_grant           invalid_request         invalid_client
unauthorized_client     unsupported_grant_type  invalid_scope
invalid_basic_header    invalid_file_format     quota_exceeded
unsupported_content_type request_too_large      folder_not_found
item_in_multiple_folders asset_not_found        max_limit_reached
permission_not_found    permission_exists       unauthorized_user
user_not_found          group_not_found         app_not_found
design_not_found        offset_too_large        page_not_found
design_or_comment_not_found                     design_or_thread_not_found
design_type_not_found   team_not_found          comment_not_found
too_many_comments       too_many_replies        message_too_long
thread_not_found        reply_not_found         design_not_fillable
autofill_data_invalid   feature_not_available   license_required
input_unsafe            display_name_unavailable user_not_managed
```

### Troubleshooting Common Errors

| Error Code | Cause | Fix |
|------------|-------|-----|
| `invalid_access_token` | Token expired or malformed | Refresh token or re-authenticate |
| `permission_denied` | User lacks permission for resource | Notify user; handle gracefully |
| `missing_scope` | Token doesn't have required scope | Add scope to OAuth request; re-authorize |
| `not_found` | Resource doesn't exist or was deleted | Verify ID; check user access |
| `design_not_found` | Design ID invalid or inaccessible | Validate design ID; check permissions |
| `too_many_requests` | Rate limit exceeded | Use exponential backoff |
| `bad_request_body` | Malformed JSON payload | Validate against API schema |
| `internal_error` | Canva server error | Retry with backoff; check canvastatus.com |
| `license_required` | Premium feature on free plan | User needs to upgrade; check trial quota |

### Comprehensive Error Handler (TypeScript)

```ts
class CanvaAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "CanvaAPIError";
  }
}

async function canvaRequest<T>(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.canva.com/rest/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.code) {
      case "invalid_access_token":
      case "revoked_access_token":
        // Trigger token refresh flow
        throw new CanvaAPIError(error.code, error.message, response.status);
      
      case "too_many_requests":
        // Retry after delay
        throw new CanvaAPIError(error.code, error.message, 429);
      
      case "missing_scope":
        // Re-authorize with correct scopes
        throw new CanvaAPIError(error.code, error.message, 403);
      
      default:
        throw new CanvaAPIError(error.code, error.message, response.status);
    }
  }

  return response.json() as T;
}
```

---

## 14. Security Recommendations

> ⚠️ **Critical constraint:** Connect API integrations **must be associated with a web app with a backend**. The following environments are NOT supported:
> - Mobile apps (iOS/Android) 
> - Desktop apps
> - Browser extensions
> - Progressive Web Apps with no backend
> - Single Page Apps (without backend)

### Token Security

| Item | Requirement |
|------|-------------|
| `client_secret` | Store in secrets vault (AWS Secrets Manager, HashiCorp Vault) or encrypted env var. Never expose in frontend code. |
| `access_token` | Encrypt at rest. Store server-side only. Never log. Never expose to browser after storage. |
| `refresh_token` | Encrypt at rest. Store separately from access tokens. Never log. Use once only. |
| `code_verifier` | Store server-side (session). Never expose to browser. |
| `state` | Store server-side. Verify on callback. |

### Implementation Checklist

- [ ] No tokens in browser localStorage or cookies without HttpOnly + Secure flags
- [ ] All API calls to Canva made from backend (Next.js API routes / server actions)
- [ ] `code_verifier` stored in server-side session, not client
- [ ] `state` validated on every OAuth callback before proceeding
- [ ] Rate limiting implemented on your API routes
- [ ] Tokens deleted when user revokes access or deletes account
- [ ] No tokens in application logs or error messages
- [ ] GitHub secret scanning enabled on repository
- [ ] HTTPS only in production
- [ ] Exponential backoff on all polling operations
- [ ] Remove `127.0.0.1` redirect URLs before going to production

### Canva's GitHub Secret Scanning

Canva has partnered with GitHub to automatically scan public repositories. If your `access_token` or `client_secret` is pushed to a public GitHub repo, **Canva will automatically revoke it**.

---

## 15. Submission Checklist (Public Integrations)

Only required for **Public** integrations (available to all Canva users). Private integrations skip this.

### Pre-Submission Requirements

- [ ] Email used for Canva login is connected to your external platform
- [ ] Read Canva Terms of Use + Developer Terms
- [ ] Production hosting (not free/sleeping services like Glitch)
- [ ] Follows Canva brand guidelines for any Canva logos/references
- [ ] Removed all `127.0.0.1` / `localhost` redirect URLs
- [ ] All scopes justified and minimized
- [ ] Authentication tested: new user, existing user, expired session
- [ ] Return navigation URL set (if using the feature)
- [ ] Webhook URL set (if using `collaboration:event` scope)
- [ ] Security audit done: no exposed tokens, rate limiting in place
- [ ] Core functionality tested end-to-end

### What Happens After Submission

1. Review ticket created
2. You cannot change integration settings during review
3. Canva will ask for: login credentials to test, a video demo, a questionnaire
4. Review duration depends on complexity — no fixed timeline
5. Feedback and approval/rejection via Developer Portal + support ticket

> **For v1 of your print-on-demand site:** You do NOT need public approval to launch and test. You can use the integration privately (just your own accounts or invited testers) without going through review. Submit for public review only when you're ready to open to all users.

---

## 16. Canva Dev MCP Server (Claude Code / Cursor)

Canva provides an **official MCP server** that gives Claude Code / Cursor real-time access to Canva's developer documentation while you code.

### Setup for Claude Code

```bash
# Add the Canva Dev MCP to Claude Code:
claude mcp add canva-dev -- npx -y @canva/cli@latest mcp
```

### Setup for Cursor

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "canva-dev": {
      "command": "npx",
      "args": ["-y", "@canva/cli@latest", "mcp"]
    }
  }
}
```

### Setup for Claude Desktop

Open Settings → Developer → Edit Config → Add:

```json
{
  "mcpServers": {
    "canva-dev": {
      "command": "npx",
      "args": ["-y", "@canva/cli@latest", "mcp"]
    }
  }
}
```

### What the MCP Server Provides

- Real-time access to `canva.dev` documentation
- Specialized tools for querying Canva API reference
- Context-aware answers about Connect API and Apps SDK
- Runs **locally on your device** — your code is not transmitted anywhere

> ⚠️ MCP tools are only available in **Agent mode** in Cursor and VS Code.  
> Mention "Canva Connect API", "Apps SDK", or "canva.dev" in your queries to trigger the MCP tools.

---

## 17. TypeScript SDK — Generating from OpenAPI

Canva does not publish an official SDK, but provides an OpenAPI spec you can generate from.

**OpenAPI Spec URL:**
```
https://www.canva.dev/sources/connect/api/latest/api.yml
```

### Generate with `openapi-ts` (used in the Starter Kit)

```bash
npm install --save-dev @hey-api/openapi-ts
```

```bash
# Run from the repository root (after cloning starter kit):
npm run generate

# This generates TypeScript types in client/ts/
```

**Manual generation:**
```bash
npx @hey-api/openapi-ts \
  --input https://www.canva.dev/sources/connect/api/latest/api.yml \
  --output ./src/canva-client \
  --client axios
```

### Generate with `openapi-generator` (alternative, any language)

```bash
# Install
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript (axios client)
openapi-generator-cli generate \
  -i https://www.canva.dev/sources/connect/api/latest/api.yml \
  -g typescript-axios \
  -o ./src/canva-generated

# Generate Python client
openapi-generator-cli generate \
  -i https://www.canva.dev/sources/connect/api/latest/api.yml \
  -g python \
  -o ./canva-python-client
```

---

## 18. Quickstart — Running the Starter Kit Locally

The official Starter Kit is a **React + Express.js e-commerce demo** that shows the full Connect API flow.

```bash
# 1. Prerequisites
node --version   # must be v24
npm --version    # must be v11

# 2. Clone
git clone https://github.com/canva-sdks/canva-connect-api-starter-kit.git
cd canva-connect-api-starter-kit

# 3. Install (from repo root)
npm install

# 4. Configure env
cd demos/ecommerce_shop
cp .env.example .env   # or: code .env

# Add your values:
# CANVA_CLIENT_ID=<your_client_id>
# CANVA_CLIENT_SECRET=<your_client_secret>

# 5. Run
npm start

# 6. Access (MUST use 127.0.0.1, NOT localhost — CORS issues with localhost)
open http://127.0.0.1:3000
```

**Starter Kit includes:**
- Full OAuth 2.0 + PKCE flow
- Design listing and creation
- Asset upload
- Export flow
- Return navigation integration
- Exponential backoff polling utility (`demos/common/utils/poll.ts`)
- TypeScript types generated from the OpenAPI spec

---

## 19. Asynchronous Job Polling Pattern

Many Canva APIs are async. They return a `job.id` immediately, and you must poll until `status !== "in_progress"`.

### Exponential Backoff Utility (TypeScript)

```ts
interface PollOptions {
  initialDelayMs?: number;   // Default: 1000
  maxDelayMs?: number;       // Default: 10000
  maxAttempts?: number;      // Default: 30
  backoffMultiplier?: number; // Default: 1.5
}

async function pollWithBackoff<T>(
  fetchFn: () => Promise<T>,
  isDone: (result: T) => boolean,
  options: PollOptions = {}
): Promise<T> {
  const {
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    maxAttempts = 30,
    backoffMultiplier = 1.5,
  } = options;

  let delay = initialDelayMs;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const result = await fetchFn();

    if (isDone(result)) {
      return result;
    }

    attempt++;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * backoffMultiplier, maxDelayMs);
  }

  throw new Error(`Polling timed out after ${maxAttempts} attempts`);
}

// Usage: poll an export job
const exportResult = await pollWithBackoff(
  () => getExportJob(accessToken, jobId),
  (result) => result.job.status !== "in_progress",
  { initialDelayMs: 2000, maxDelayMs: 15000, maxAttempts: 20 }
);
```

### APIs That Are Asynchronous (require polling)

| API | Create endpoint | Poll endpoint |
|-----|----------------|---------------|
| Asset upload | `POST /asset-uploads` | `GET /asset-uploads/{jobId}` |
| Design autofill | `POST /autofills` | `GET /autofills/{jobId}` |
| Design export | `POST /exports` | `GET /exports/{exportId}` |
| Design import | `POST /design-imports` | `GET /design-imports/{jobId}` |
| Design resize | `POST /designs/{id}/resize` | `GET /designs/{id}/resize/{jobId}` |

---

## 20. Trial Quotas (Preview Feature)

Some premium API endpoints offer **free trial quotas** for users on free Canva plans.

> ⚠️ Trial quotas are a **preview feature**. Breaking changes may occur without a new API version. Public integrations using preview features will not pass the review process.

**Example: Resize API trial**

Free users get a limited number of resize operations. The response includes quota info:

```json
{
  "job": {
    "id": "37e319c0-...",
    "status": "in_progress"
  },
  "trial_information": {
    "uses_remaining": 1,
    "upgrade_url": "https://www.canva.com/?tailoringUpsellDialog=GENERIC_C4W&utm_source=canva_connect_api_resize"
  }
}
```

When the quota is exhausted:

```json
// HTTP 403
{
  "code": "permission_denied",
  "message": "You have reached your limit for this trial. For full access to this feature Upgrade to Pro https://..."
}
```

---

## 21. Key Limitations & Critical Notes

### What Canva Connect API CANNOT Do

| Limitation | Detail |
|-----------|--------|
| ❌ No iframe embed | You **cannot** embed the Canva editor inside your website. Users must navigate to `canva.com` to design. |
| ❌ No custom canvas dimensions in "preset" mode | Custom pixel dimensions require `type: "custom"` — no preset `A4`, etc. in the Create Design API yet. Verify in OpenAPI spec. |
| ❌ No real-time design sync | You cannot stream or watch design changes in real time. Export when done. |
| ❌ Autofill is Enterprise-only | Both developer AND user must be on Canva Enterprise. Cannot be used on free plans. |
| ❌ No SPA / mobile app support | Backend server required for secure credential storage. |
| ❌ Preview APIs blocked from public review | Any integration using preview APIs will be rejected during the public submission process. |
| ❌ localhost not allowed as redirect URL | Use `http://127.0.0.1:<port>` for local development. |

### What This Means for Your Print-on-Demand Site

1. **The Canva editor is always at canva.com** — users leave your site, design, come back. This is the intended and only supported flow.
2. **Return navigation is what brings them back** — configure the Return URL in Developer Portal.
3. **Export happens after return** — you call the export API after the user returns via `correlation_jwt`.
4. **You don't need Enterprise** for the core flow. Only needed if you want autofill/brand templates.
5. **For private testing** (before public submission), your integration works immediately — no approval needed. Only submit for review when you're ready for all Canva users.

### Environment Variables Required

```env
# .env.local (Next.js)
CANVA_CLIENT_ID=             # From Developer Portal
CANVA_CLIENT_SECRET=         # From Developer Portal — keep secret, never expose to client
CANVA_REDIRECT_URI=          # e.g. http://127.0.0.1:3000/api/canva/callback
CANVA_RETURN_URL=            # e.g. http://127.0.0.1:3000/api/canva/return
```

### Useful Links

| Resource | URL |
|----------|-----|
| Developer Portal | https://www.canva.com/developers/ |
| Your Integrations | https://www.canva.com/developers/integrations |
| Connect API Docs | https://www.canva.dev/docs/connect/ |
| OpenAPI Spec | https://www.canva.dev/sources/connect/api/latest/api.yml |
| Starter Kit GitHub | https://github.com/canva-sdks/canva-connect-api-starter-kit |
| Postman Collection | https://www.postman.com/canva-developers/canva-developers/collection/oi7dfns/canva-connect-api |
| API Status | https://www.canvastatus.com/ |
| Community Forum | https://community.canva.dev/ |
| Support | https://canva-external.atlassian.net/servicedesk/customer/portal/2/group/2 |
| Canva Brand Guidelines | https://www.canva.dev/docs/connect/guidelines/brand/ |
| Developer Terms | https://www.canva.com/policies/canva-developer-terms/ |

---

*Last updated from canva.dev — June 2025*
