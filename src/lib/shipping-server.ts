import "server-only";
import { normalizeIndianState } from "./shipping";

/** Validate a real domestic postal destination, not just a six-digit string.
 * Only the PIN is sent to the public postal directory; no customer details.
 * A lookup outage fails closed so an unverified destination cannot be charged.
 */
export async function verifyIndianPincode(
  pincode: string,
  state: string,
  lookup: typeof fetch = fetch,
): Promise<string | null> {
  const response = await lookup(`https://api.postalpincode.in/pincode/${encodeURIComponent(pincode.trim())}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 86400 },
  });
  if (!response.ok) throw new Error("The postal lookup is unavailable. Please try again shortly.");
  const data = await response.json();
  if (!Array.isArray(data) || !data[0] || typeof data[0].Status !== "string") {
    throw new Error("The postal lookup is unavailable. Please try again shortly.");
  }
  const offices: { Country?: string; State?: string; Pincode?: string }[] =
    Array.isArray(data[0].PostOffice) ? data[0].PostOffice : [];
  const domestic = offices.filter(office => office.Country?.toLowerCase() === "india" && office.Pincode === pincode.trim());
  if (data[0].Status !== "Success" || domestic.length === 0) {
    return "This PIN code is not a recognised Indian shipping destination. Please check your address.";
  }
  if (!domestic.some(office => typeof office.State === "string" && normalizeIndianState(office.State) === normalizeIndianState(state))) {
    return "This PIN code does not match the selected state. Please check your shipping address.";
  }
  return null;
}
