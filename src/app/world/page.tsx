import type { Metadata } from "next";
import Link from "next/link";

import { ScrollWorldClient } from "@/components/ScrollWorldClient";
import { WORLD_SCENES } from "@/components/scroll-world/content";

export const metadata: Metadata = {
  title: "Inside Framers Lab | From Image to Delivery",
  description:
    "Enter Framers Lab and follow eight stages of custom framing—from art intake and design through craft, inspection, packing, and delivery across India.",
  alternates: {
    canonical: "https://framerslab.in/world",
  },
  openGraph: {
    title: "Inside Framers Lab | From Image to Delivery",
    description:
      "A cinematic walkthrough of how Framers Lab turns one meaningful image into a made-to-order frame and delivers it across India.",
    url: "https://framerslab.in/world",
    siteName: "Framers Lab",
    type: "website",
  },
};

export default function WorldPage() {
  return (
    <main>
      <section
        data-sw-seo
        className="min-h-screen bg-black px-5 py-20 text-white md:px-16"
        aria-label="How Framers Lab works"
      >
        <h1 className="max-w-4xl text-5xl leading-none md:text-8xl">
          Inside Framers Lab.
        </h1>
        <p className="mt-6 max-w-2xl text-lg">
          Follow eight connected stages—from the first image inspection to the
          finished frame leaving our lab for your wall.
        </p>

        {WORLD_SCENES.map((scene) => (
          <div key={scene.id} className="mt-12 max-w-2xl border-t-2 border-white pt-6">
            <h2 className="text-3xl">{scene.title}</h2>
            <p className="mt-3">{scene.body}</p>
          </div>
        ))}

        <p className="mt-12 flex gap-6">
          <Link href="/design/start">Start framing</Link>{" "}
          <Link href="/#frames">Browse frames</Link>
        </p>
      </section>

      <ScrollWorldClient />
    </main>
  );
}
