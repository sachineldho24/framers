export const GALLERY_BASE = "/gallery-assets/v07";

const spaces = [
  ["living", "Living", "Make room for what you love.", "Warm wood, soft light, and a landscape that gives the room somewhere to wander.", 0],
  ["motoring", "Motoring", "For the things that move you.", "A space for the machines, memories, and miles that stay with you.", 0.11236606515402298],
  ["together", "Together", "Everyday moments. Worth keeping.", "Give shared meals, familiar faces, and your favourite memories a place on the wall.", 0.44831844772073964],
  ["childhood", "Childhood", "Little moments grow with us.", "First adventures, big imaginations, and a room full of stories still being written.", 0.5516530618976262],
  ["study", "Study", "A little perspective.", "Surround your working day with the places and ideas that inspire you.", 0.8744143977690316],
  ["anniversary", "Anniversary", "A life, framed together.", "Celebrate your people and the moments that turn a house into your home.", 0.990085347192292],
] as const;

export const GALLERY_ROOMS = spaces.map(([id, title, headline, description, stop], index) => ({
  id, title, headline, description, stop, index,
  image: `${GALLERY_BASE}/room-${index}.webp`,
  artwork: `${GALLERY_BASE}/art-${index}.webp`,
  model: `${GALLERY_BASE}/room-${index}.glb`,
}));

export type GalleryRoom = (typeof GALLERY_ROOMS)[number];
export type SceneData = {
  anchors: { position: [number, number, number]; normal: [number, number, number]; node: string }[];
  lights: { name: string; type: string; position: [number, number, number]; target: [number, number, number]; energy: number; color: [number, number, number]; size: number }[];
};
