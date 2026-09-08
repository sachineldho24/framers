import type { Metadata } from "next";
import { GalleryClient } from "@/components/gallery/GalleryClient";

export const metadata: Metadata = {
  title: "The Gallery — Framers",
  description: "Walk through six spaces filled with framing inspiration. Explore the artwork, then create a frame of your own.",
};

export default function GalleryPage() {
  return <GalleryClient />;
}
