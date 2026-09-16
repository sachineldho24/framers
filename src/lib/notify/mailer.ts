/**
 * The one function that actually talks to the email provider.
 *
 * Resend over plain `fetch` rather than its SDK: the payload is four fields
 * wide, and a dependency that exists to wrap one POST is a dependency that has
 * to be upgraded. Swapping providers means rewriting this file and nothing
 * else - both callers (`order-email.ts`, `new-order-alert.ts`) only know about
 * `deliver(to, message)`.
 *
 * `deliver` never throws. A provider outage must not fail the order write that
 * triggered the mail: every caller has already committed its change to the
 * database by the time we get here, so the return value reports what happened
 * instead.
 */

import "server-only";

import { serverEnv } from "@/lib/env";

export interface Message {
  subject: string;
  text: string;
  html?: string;
  /** Where a reply goes - the customer, for operator alerts. */
  replyTo?: string | null;
}

export interface Delivery {
  sent: boolean;
  /** Provider id on success, or why it failed. */
  detail: string;
}

const ENDPOINT = "https://api.resend.com/emails";

/** Long enough for a slow provider, short enough not to hang a webhook. */
const TIMEOUT_MS = 10_000;

export async function deliver(to: string, message: Message): Promise<Delivery> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.emailApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv.emailFrom,
        to: [to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Resend puts the useful part ("domain not verified", "invalid from") in
      // the body, so keep it - truncated, because it lands in an order event
      // that an operator reads.
      const body = await response.text().catch(() => "");
      return {
        sent: false,
        detail: `provider returned ${response.status}: ${body.slice(0, 300)}`,
      };
    }

    const data = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;
    return { sent: true, detail: data?.id ?? "accepted" };
  } catch (e) {
    const detail =
      e instanceof Error && e.name === "AbortError"
        ? `provider timed out after ${TIMEOUT_MS / 1000}s`
        : e instanceof Error
          ? e.message
          : "unknown provider error";
    return { sent: false, detail };
  } finally {
    clearTimeout(timer);
  }
}
