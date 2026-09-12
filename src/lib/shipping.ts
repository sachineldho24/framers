export const OUTSIDE_INDIA_MESSAGE = "Shipping outside India is not available right now.";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export function normalizeIndianState(state: string): string {
  const value = state.trim().toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    orissa: "odisha", pondicherry: "puducherry", uttaranchal: "uttarakhand",
    "dadra and nagar haveli": "dadra and nagar haveli and daman and diu",
    "daman and diu": "dadra and nagar haveli and daman and diu",
    "andaman and nicobar": "andaman and nicobar islands",
  };
  return aliases[value] ?? value;
}

export function shippingError(address: { country?: unknown; state?: unknown; pincode?: unknown }): string | null {
  if (typeof address.country !== "string" || !["IN", "INDIA"].includes(address.country.trim().toUpperCase())) {
    return OUTSIDE_INDIA_MESSAGE;
  }
  if (typeof address.state !== "string" || !INDIAN_STATES.some(state => normalizeIndianState(state) === normalizeIndianState(address.state as string))) {
    return "Please select an Indian state or union territory.";
  }
  if (typeof address.pincode !== "string" || !/^[1-9]\d{5}$/.test(address.pincode.trim())) {
    return "Enter a valid 6-digit Indian PIN code. Shipping is available within India only.";
  }
  return null;
}
