/**
 * Centralised environment variable access.
 * Server-only secrets are read lazily so that importing this module in a
 * client component does not throw — only calling a server getter does.
 *
 * Full list documented in plan/02-architecture.md.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.local.example.`
    );
  }
  return value;
}

/** Public — safe to expose to the browser. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

/** True if Razorpay server credentials are configured. */
export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_SECRET &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  );
}

/** Server-only secrets. Never import the *values* into client code. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  },
  get razorpayKeySecret() {
    return required("RAZORPAY_KEY_SECRET", process.env.RAZORPAY_KEY_SECRET);
  },
  get razorpayWebhookSecret() {
    return required(
      "RAZORPAY_WEBHOOK_SECRET",
      process.env.RAZORPAY_WEBHOOK_SECRET
    );
  },
  /**
   * Transactional email. Supplied by the Vercel Marketplace messaging
   * integration; until it is provisioned these are absent and
   * `isEmailConfigured()` is false, which makes a ship/deliver notification a
   * logged no-op instead of a crash.
   */
  get emailApiKey() {
    return required("EMAIL_API_KEY", process.env.EMAIL_API_KEY);
  },
  get emailFrom() {
    return required("EMAIL_FROM", process.env.EMAIL_FROM);
  },
  /**
   * Where new-order alerts land - the bench inbox that starts a framing job.
   * Deliberately not defaulted to `EMAIL_FROM`: a sender identity and a
   * mailbox an operator reads are different things, and silently mailing
   * alerts to the From address is how they end up unread.
   */
  get orderNotificationEmail() {
    return required(
      "ORDER_NOTIFICATION_EMAIL",
      process.env.ORDER_NOTIFICATION_EMAIL
    );
  },
};

/** True if a transactional email provider is wired up. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

/**
 * True if the new-order alert can be sent. Distinct from `isEmailConfigured`
 * because the alert additionally needs somewhere to go - customer-facing
 * fulfilment mail does not.
 */
export function isOrderAlertConfigured(): boolean {
  return isEmailConfigured() && Boolean(process.env.ORDER_NOTIFICATION_EMAIL);
}
