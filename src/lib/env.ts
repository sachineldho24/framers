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

/** True if the Canva integration credentials are configured. */
export function isCanvaConfigured(): boolean {
  return Boolean(
    process.env.CANVA_CLIENT_ID &&
      process.env.CANVA_CLIENT_SECRET &&
      process.env.CANVA_REDIRECT_URI
  );
}

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
  get canvaClientId() {
    return required("CANVA_CLIENT_ID", process.env.CANVA_CLIENT_ID);
  },
  get canvaClientSecret() {
    return required("CANVA_CLIENT_SECRET", process.env.CANVA_CLIENT_SECRET);
  },
  get canvaRedirectUri() {
    return required("CANVA_REDIRECT_URI", process.env.CANVA_REDIRECT_URI);
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
};
