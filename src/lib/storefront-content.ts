import { FEATURED_WORKS, HERO_WORKS, WORKS, WORK_CATEGORIES } from "./works";

export const HERO_ORBIT_FRAMES = HERO_WORKS.map(work => ({
  id: work.id,
  image: work.image,
  alt: work.alt,
  title: work.title,
  href: `/works/${work.category}`,
}));

export const SHOP_CATEGORIES = WORK_CATEGORIES.map(category => {
  const cover = WORKS.find(work => work.id === category.cover);
  if (!cover) throw new Error(`Missing category cover: ${category.cover}`);
  return {
    label: category.label,
    image: cover.image,
    alt: cover.alt,
    href: `/works/${category.id}`,
    count: WORKS.filter(work => work.category === category.id).length,
  };
});

export const LATEST_CREATIONS = FEATURED_WORKS.map(work => ({
  image: work.image,
  alt: work.alt,
  title: work.title,
  href: `/works/${work.category}`,
}));

/**
 * Social proof for the landing page.
 *
 * **These six quotes are placeholder copy, not real customers.** The section is
 * real and the layout is final; the words are not. Replace each entry with a
 * quote an actual customer gave you, alongside their consent to show the name
 * and city — presenting invented quotes as customer testimonials is a
 * misrepresentation, and in India it is also an ASCI/Consumer Protection Act
 * problem. Every claim below is deliberately one the product already makes
 * elsewhere on the page (300 GSM archival stock, dispatch in three days, free
 * shipping, replaced if damaged) so nothing new is being promised.
 */
export const TESTIMONIALS = [
  {
    id: "aarti-pune",
    quote:
      "I uploaded a photo from my parents' wedding, cropped it in the editor, and the frame that arrived looked exactly like the preview. No surprises.",
    name: "Aarti Deshpande",
    city: "Pune",
    occasion: "Anniversary collage",
    rating: 5,
  },
  {
    id: "rohit-bengaluru",
    quote:
      "Ordered on a Monday, it was dispatched Wednesday and on my wall by the weekend. The 300 GSM stock feels like a print, not a poster.",
    name: "Rohit Menon",
    city: "Bengaluru",
    occasion: "Cars & Bikes print",
    rating: 5,
  },
  {
    id: "sneha-mumbai",
    quote:
      "Paid over UPI in two taps. I was expecting the usual card-form mess and there wasn't any.",
    name: "Sneha Kulkarni",
    city: "Mumbai",
    occasion: "Birthday gift frame",
    rating: 5,
  },
  {
    id: "imran-hyderabad",
    quote:
      "The corner of the glass was chipped in transit. Sent one photo, got a replacement without an argument.",
    name: "Imran Qureshi",
    city: "Hyderabad",
    occasion: "Housewarming gift",
    rating: 4,
  },
  {
    id: "meera-kochi",
    quote:
      "The editor showed me where the frame's lip would cover the photo, so I moved my daughter's face out of it before ordering. That detail saved the print.",
    name: "Meera Nair",
    city: "Kochi",
    occasion: "Family portrait",
    rating: 5,
  },
  {
    id: "harpreet-delhi",
    quote:
      "Bought three in different sizes for a gallery wall. Same black moulding on all of them, so the wall actually looks planned.",
    name: "Harpreet Singh",
    city: "New Delhi",
    occasion: "Gallery wall set",
    rating: 5,
  },
] as const;
