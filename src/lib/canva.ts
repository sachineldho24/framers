import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Canva Connect API v1 client wrapper.
 * Reference: plan/01-canva-api-reality.md.
 *
 * NOTE: exact request/response field names for a couple of fields (notably the
 * PDF export quality enum) could not be verified against live docs at build
 * time and are flagged below. Verify against https://www.canva.com/developers/
 * during live testing (Phase 3 verification).
 */

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const API_BASE = "https://api.canva.com/rest/v1";

/** Scopes required by Framers. Keep minimal — reviewers check this. */
export const CANVA_SCOPES = [
  "design:content:read",
  "design:content:write",
  "design:meta:read",
  "asset:read",
  "profile:read",
] as const;

// PDF export quality. Verified against the live export API: enum is
// "regular" (default) | "pro". "pro" is print-quality but PLAN-GATED — it fails
// for Free-plan users / designs with unpurchased premium elements
// (job.error.code === "license_required" | "approval_required"). exportAndWait
// requests "pro" first, then transparently retries as "regular" on that error,
// so Free customers (the normal case) still get a usable PDF.
type PdfExportQuality = "regular" | "pro";
const PDF_EXPORT_QUALITY: PdfExportQuality = "pro";

/** Export error codes that mean "pro quality isn't available for this user/design". */
const LICENSE_ERROR_CODES = new Set(["license_required", "approval_required"]);

export interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
  scope?: string;
}

export interface CanvaDesign {
  id: string;
  editUrl: string;
  viewUrl: string;
}

export type CanvaExportFormat = "png" | "pdf";

function basicAuthHeader(): string {
  const creds = `${serverEnv.canvaClientId}:${serverEnv.canvaClientSecret}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

/** Editor URL for a design id (deterministic — no API call needed). */
export function editorUrl(designId: string): string {
  return `https://www.canva.com/design/${designId}/edit`;
}

/** JWKS endpoint used to verify the return-navigation correlation JWT. */
export const CANVA_JWKS_URL = "https://api.canva.com/rest/v1/connect/keys";

/**
 * Append a correlation_state to an editor URL. When the user clicks "Return to
 * Framers" in Canva, this value comes back to us in the correlation JWT, letting
 * us recover which frame they were designing. Max 50 chars (a frame UUID fits).
 */
export function withCorrelationState(
  editUrl: string,
  correlationState: string
): string {
  const url = new URL(editUrl);
  url.searchParams.set("correlation_state", correlationState);
  return url.toString();
}

/** Build the OAuth authorize URL the user is redirected to. */
export function buildAuthorizeUrl(params: {
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", serverEnv.canvaClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", serverEnv.canvaRedirectUri);
  url.searchParams.set("scope", CANVA_SCOPES.join(" "));
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  return `Canva API ${res.status}: ${text.slice(0, 500)}`;
}

/** Exchange an authorization code for tokens (PKCE). */
export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
}): Promise<CanvaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: serverEnv.canvaRedirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as CanvaTokenResponse;
}

/** Refresh an expired access token. */
export async function refreshTokens(
  refreshToken: string
): Promise<CanvaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as CanvaTokenResponse;
}

/** Create a design with custom (preset) pixel dimensions. */
export async function createDesign(params: {
  accessToken: string;
  widthPx: number;
  heightPx: number;
  title: string;
}): Promise<CanvaDesign> {
  const res = await fetch(`${API_BASE}/designs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      design_type: {
        type: "custom",
        width: params.widthPx,
        height: params.heightPx,
      },
      title: params.title,
    }),
  });

  if (!res.ok) throw new Error(await readError(res));

  const json = (await res.json()) as {
    design: { id: string; urls?: { edit_url?: string; view_url?: string } };
  };
  const id = json.design.id;
  return {
    id,
    editUrl: json.design.urls?.edit_url ?? editorUrl(id),
    viewUrl: json.design.urls?.view_url ?? "",
  };
}

interface ExportJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  urls?: string[];
  error?: { code: string; message: string };
}

/** Start an export job for a design in the given format. */
export async function createExport(params: {
  accessToken: string;
  designId: string;
  format: CanvaExportFormat;
  /** PDF only; ignored for PNG. Defaults to PDF_EXPORT_QUALITY ("pro"). */
  pdfQuality?: PdfExportQuality;
}): Promise<ExportJob> {
  const format =
    params.format === "pdf"
      ? { type: "pdf", export_quality: params.pdfQuality ?? PDF_EXPORT_QUALITY }
      : { type: "png" };

  const res = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ design_id: params.designId, format }),
  });

  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { job: ExportJob };
  return json.job;
}

/** Fetch the current status of an export job. */
export async function getExport(params: {
  accessToken: string;
  exportId: string;
}): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/exports/${params.exportId}`, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { job: ExportJob };
  return json.job;
}

/**
 * Create an export and poll until it completes.
 * Polls every `intervalMs` up to `maxAttempts` (default 20 × 3s = 60s).
 * Returns the first download URL on success.
 *
 * For PDF, requests "pro" quality first; if Canva rejects it because the user's
 * plan / design isn't licensed for it (license_required / approval_required),
 * transparently retries once at "regular" quality so Free-plan customers still
 * get a PDF.
 */
export async function exportAndWait(params: {
  accessToken: string;
  designId: string;
  format: CanvaExportFormat;
  intervalMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  try {
    return await runExportJob(params);
  } catch (err) {
    if (params.format === "pdf" && err instanceof CanvaLicenseError) {
      return await runExportJob({ ...params, pdfQuality: "regular" });
    }
    throw err;
  }
}

/** Thrown when an export fails because the requested quality is plan-gated. */
class CanvaLicenseError extends Error {}

/** One export attempt: create the job, poll to completion, return first URL. */
async function runExportJob(params: {
  accessToken: string;
  designId: string;
  format: CanvaExportFormat;
  pdfQuality?: PdfExportQuality;
  intervalMs?: number;
  maxAttempts?: number;
}): Promise<string> {
  const intervalMs = params.intervalMs ?? 3000;
  const maxAttempts = params.maxAttempts ?? 20;

  const job = await createExport(params);
  let current = job;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (current.status === "success") {
      const url = current.urls?.[0];
      if (!url) throw new Error("Canva export succeeded but returned no URL.");
      return url;
    }
    if (current.status === "failed") {
      const code = current.error?.code;
      if (code && LICENSE_ERROR_CODES.has(code)) {
        throw new CanvaLicenseError(current.error?.message ?? code);
      }
      throw new Error(
        `Canva export job failed${current.error ? `: ${current.error.code}` : ""}.`
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
    current = await getExport({
      accessToken: params.accessToken,
      exportId: job.id,
    });
  }

  throw new Error("Canva export timed out.");
}
