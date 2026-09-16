import { WORK_ITEMS } from "./works-data";

export const WORK_CATEGORIES = [
  { id: "cars", label: "Cars", description: "Built around your drive. Custom artwork for the cars that mean more than a way to get there.", cover: "cars-bmw-m3-yellow-1" },
  { id: "bikes", label: "Bikes", description: "Your ride, your story. Two wheels and a little personality, made into something worth keeping.", cover: "bikes-yamaha-r15-austrian-1" },
  { id: "buses", label: "Buses", description: "Big journeys deserve a place on the wall. Artwork for coaches, crews, and the roads they share.", cover: "buses-lexus-the-brothers-1" },
  { id: "birthday", label: "Birthday", description: "Their day. Their people. Personal photos brought together to celebrate someone you love.", cover: "birthday-jobin-xavier-photo-collage-2" },
  { id: "anniversary", label: "Anniversary", description: "For the years, the memories, and everything still to come. A celebration of life together.", cover: "anniversary-25th-wedding-anniversary-1" },
  { id: "portraits", label: "Portraits", description: "Familiar faces, favourite moments. Personal photo collages with a story behind every image.", cover: "portraits-mithra-photo-collage-2" },
  { id: "vans", label: "Vans", description: "Made for the open road. Custom artwork with as much character as the vehicles themselves.", cover: "vans-force-traveller-varoor-3" },
  { id: "mockups", label: "Frame mockups", description: "Picture the finished piece. A closer look at how our artwork comes together in a frame.", cover: "mockups-yamaha-rx100-wall-1" },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number]["id"];
export type Work = {
  id: string;
  title: string;
  category: WorkCategory;
  image: string;
  fullImage: string;
  alt: string;
  width: number;
  height: number;
};

export const WORKS: readonly Work[] = WORK_ITEMS;

export function getWorkCategory(id: string) {
  return WORK_CATEGORIES.find(category => category.id === id);
}

function findWork(id: string): Work {
  const work = WORKS.find(work => work.id === id);
  if (!work) throw new Error(`Missing featured artwork: ${id}`);
  return work;
}

export const HERO_WORKS = [
  "cars-bmw-m3-yellow-1",
  "birthday-jobin-xavier-photo-collage-2",
  "bikes-yamaha-r15-austrian-1",
  "anniversary-25th-wedding-anniversary-1",
  "buses-lexus-the-brothers-1",
  "portraits-mithra-photo-collage-2",
].map(findWork);

export const FEATURED_WORKS = [
  ...HERO_WORKS,
  ...[
    "cars-land-rover-defender-1", "bikes-triumph-speed-400-2",
    "mockups-yamaha-rx100-wall-1", "vans-force-traveller-varoor-3",
    "cars-volkswagen-polo-solo-leveling-anime-2", "cars-audi-rs4-9",
    "bikes-yamaha-rx100-2", "cars-suzuki-baleno-2",
  ].map(findWork),
];

// A mixed overview lets personal gifts and smaller collections be discovered
// alongside the larger automotive archive.
const featuredIds = new Set(FEATURED_WORKS.map(work => work.id));
const queues = WORK_CATEGORIES.map(category => WORKS.filter(work => work.category === category.id && !featuredIds.has(work.id)));
const overview: Work[] = [...FEATURED_WORKS];
for (let index = 0; queues.some(queue => index < queue.length); index++) {
  for (const queue of queues) if (queue[index]) overview.push(queue[index]);
}

export function getWorksPage(category?: string, query?: string | string[]) {
  if (category !== undefined && !getWorkCategory(category)) return null;
  const collection = category ? overview.filter(work => work.category === category) : overview;
  const totalPages = Math.max(1, Math.ceil(collection.length / 24));
  const requested = typeof query === "string" && /^[1-9]\d*$/.test(query) ? Number(query) : 1;
  const page = Math.min(totalPages, requested);
  return { items: collection.slice((page - 1) * 24, page * 24), total: collection.length, totalPages, page };
}
