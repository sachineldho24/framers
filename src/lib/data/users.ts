import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * `public.orders` denormalises the shipping address but carries no email — the
 * only copy lives on `auth.users`. Both the admin detail view ("who do I reply
 * to?") and the ship/deliver mail need it, so it is fetched with the service
 * role through the Admin API rather than joined.
 */
export interface UserContact {
  email: string | null;
  phone: string | null;
}

/** Contact details for a user id. Never throws — a missing user is `null`s. */
export async function getUserContact(userId: string): Promise<UserContact> {
  const supabase = createServiceClient();
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) return { email: null, phone: null };
    return {
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
    };
  } catch (e) {
    console.error("[users] getUserContact failed", e);
    return { email: null, phone: null };
  }
}
