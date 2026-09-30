import "server-only";

/**
 * Small fetch helpers for provider APIs: a deadline on every call, the
 * provider's own error message pulled out of whatever shape it comes in, and
 * polling for the ones that answer "come back later".
 */

/** An error from a provider, with a message that is safe to show. */
export class ProviderError extends Error {
  readonly status: number;
  /** The prompt or picture was refused by the provider's safety check. */
  readonly refused: boolean;
  constructor(message: string, status = 502, refused = false) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.refused = refused;
  }
}

/** Overall deadline for one generation, inside the route's `maxDuration`. */
export const DEADLINE_MS = 270_000;

function messageFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" && body.trim() ? body.trim().slice(0, 300) : null;
  const b = body as Record<string, unknown>;
  const candidates = [
    (b.error as Record<string, unknown> | undefined)?.message,
    b.error,
    b.message,
    b.msg,
    b.detail,
    (b.detail as Record<string, unknown>[] | undefined)?.[0]?.msg,
    b.failMsg,
  ];
  for (const c of candidates) if (typeof c === "string" && c.trim()) return c.trim().slice(0, 300);
  return null;
}

const REFUSAL = /safety|moderat|nsfw|policy|inappropriate|not allowed|blocked|violat/i;

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number; provider: string }
): Promise<T> {
  const { timeoutMs = DEADLINE_MS, provider, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.name + error.message);
    throw new ProviderError(timedOut ? `${provider} took too long to answer.` : `Couldn’t reach ${provider}.`, 504);
  }
  const body = await readBody(res);
  if (!res.ok) {
    const message = messageFrom(body) ?? `${provider} returned ${res.status}.`;
    const refused = res.status === 422 || REFUSAL.test(message);
    console.warn(`[aiGen] ${provider} ${res.status}:`, typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500));
    throw new ProviderError(
      refused ? `${provider} declined this request: ${message}` : res.status === 429 ? `${provider} is busy. Please try again in a minute.` : `${provider}: ${message}`,
      res.status === 429 ? 429 : refused ? 422 : 502,
      refused
    );
  }
  return body as T;
}

export function postJson<T = unknown>(url: string, body: unknown, headers: Record<string, string>, provider: string, timeoutMs?: number) {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    provider,
    timeoutMs,
  });
}

export function postForm<T = unknown>(url: string, form: FormData, headers: Record<string, string>, provider: string) {
  return request<T>(url, { method: "POST", headers, body: form, provider });
}

export function getJson<T = unknown>(url: string, headers: Record<string, string>, provider: string) {
  return request<T>(url, { method: "GET", headers, provider, timeoutMs: 30_000 });
}

/**
 * Call `check` until it returns a value, backing off from `startMs` to
 * `maxMs` between tries, until `deadline` (epoch ms).
 */
export async function poll<T>(
  check: () => Promise<T | undefined>,
  provider: string,
  deadline: number,
  startMs = 1000,
  maxMs = 4000
): Promise<T> {
  let wait = startMs;
  while (Date.now() < deadline) {
    const done = await check();
    if (done !== undefined) return done;
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(maxMs, Math.round(wait * 1.4));
  }
  throw new ProviderError(`${provider} took too long. Please try again.`, 504);
}

/** Download a result the provider left at a URL. */
export async function download(url: string, provider: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    return new Uint8Array(Buffer.from(url.slice(comma + 1), "base64"));
  }
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: "no-store" });
  } catch {
    throw new ProviderError(`Couldn’t download the picture from ${provider}.`, 502);
  }
  if (!res.ok) throw new ProviderError(`Couldn’t download the picture from ${provider} (${res.status}).`, 502);
  return new Uint8Array(await res.arrayBuffer());
}

export function fromBase64(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, "base64"));
}
