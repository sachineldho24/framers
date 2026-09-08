export const HERO_ORBIT_FRAMES = [
  {
    id: "birthday-gold",
    image: "/storefront/birthday-gold.png",
    alt: "Personalised black and gold birthday frame displayed on a shelf",
  },
  {
    id: "anniversary-couple",
    image: "/storefront/anniversary-couple.png",
    alt: "Personalised couple anniversary frame displayed beside a sofa",
  },
  {
    id: "bmw",
    image: "/storefront/bmw-frame.jpg",
    alt: "Neon yellow BMW artwork in a black frame",
  },
  {
    id: "birthday-pink",
    image: "/storefront/birthday-pink.png",
    alt: "Personalised pink birthday frame displayed in a home interior",
  },
  {
    id: "anniversary-collage",
    image: "/storefront/anniversary-collage.png",
    alt: "Personalised anniversary collage frame displayed in a warm interior",
  },
  {
    id: "duke",
    image: "/storefront/duke-frame.jpg",
    alt: "KTM Duke motorcycle artwork in a black frame",
  },
] as const;
export const SHOP_CATEGORIES = [
  {
    label: "Birthday",
    image: "/storefront/birthday-pink.png",
    alt: "Personalised birthday frame",
    href: "/design/start",
  },
  {
    label: "Wedding & Anniversary",
    image: "/storefront/anniversary-collage.png",
    alt: "Personalised wedding and anniversary frame",
    href: "/design/start",
  },
  {
    label: "Cars & Bikes",
    image: "/storefront/duke-frame.jpg",
    alt: "Framed motorcycle artwork",
    href: "/design/start",
  },
] as const;

export const LATEST_CREATIONS = [
  { image: "/latest-creations/creation-01.jpg", alt: "Light brown 3D minimalist wall frame mockup" },
  { image: "/latest-creations/creation-02.jpg", alt: "Black and white clean minimalist wall photo frame" },
  { image: "/latest-creations/creation-03.jpg", alt: "White minimal wall art mockup in a bright interior" },
  { image: "/latest-creations/creation-04.jpg", alt: "Beige and white minimalist wall art mockup" },
  { image: "/latest-creations/creation-05.jpg", alt: "Gray modern wall art frame mockup" },
  { image: "/latest-creations/creation-06.jpg", alt: "Beige and black minimalist wall frame mockup" },
  { image: "/latest-creations/creation-07.jpg", alt: "Beige and brown three-frame wall mockup" },
  { image: "/latest-creations/creation-08.jpg", alt: "Grey and yellow six-frame gallery wall mockup" },
  { image: "/latest-creations/creation-09.jpg", alt: "Gray minimalist luxury wall frame mockup" },
  { image: "/latest-creations/creation-10.jpg", alt: "Beige minimalist 3D wall frame mockup" },
  { image: "/latest-creations/creation-11.jpg", alt: "Grey and gold 3D wall frame mockup" },
  { image: "/latest-creations/creation-12.jpg", alt: "Grey modern 3D wall frame mockup" },
  { image: "/latest-creations/creation-13.jpg", alt: "Green and pink 3D minimalist wall frame mockup" },
  { image: "/latest-creations/creation-14.jpg", alt: "Red and black bold wall frame mockup" },
] as const;

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
