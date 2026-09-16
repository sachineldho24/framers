import Link from "next/link";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata = { title: "Contact us - Framers" };

/**
 * Where a custom-size request goes.
 *
 * A frame we do not stock cannot be priced by checkout - the size decides how
 * much moulding, mount board and glass the job eats - so instead of letting
 * someone pick an off-the-shelf size that is wrong, the designer sends them
 * here and we quote by hand.
 *
 * Instagram is the only channel this page offers because it is the only one
 * that actually exists: it is the same handle the privacy policy, the terms and
 * the order page already point at. When a support phone or inbox is real,
 * add it here rather than inventing an address that nobody reads.
 */
const INSTAGRAM = "https://www.instagram.com/_posterx.in";

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-3xl">Contact us</h1>
        <p className="label-caps mt-2 text-on-surface-variant">
          Custom sizes &amp; order help
        </p>

        <section className="mt-8 border-2 border-border-high-contrast p-6">
          <h2 className="font-display text-xl font-black uppercase">
            A custom size frame
          </h2>
          <p className="mt-3 text-base text-on-surface-variant">
            We frame a set of standard sizes off the shelf. Anything bigger,
            smaller or a different shape is made to order and quoted by hand,
            which is why it cannot go through checkout.
          </p>
          <p className="label-caps mt-6 text-on-surface-variant">
            Tell us these four things
          </p>
          <ul className="mt-3 flex flex-col gap-2 text-base text-on-surface-variant">
            <li>The size you want, in millimetres or inches</li>
            <li>How many you need</li>
            <li>Your city, and when you need it by</li>
            <li>A link to the artwork, if you already have it</li>
          </ul>
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="brutalist-shadow brutalist-press label-caps mt-6 inline-flex items-center bg-neon-accent px-5 py-3 text-black"
          >
            Message @_posterx.in
          </a>
          <p className="mt-3 text-[14px] text-on-surface-variant">
            An Instagram DM is the fastest way to reach us.
          </p>
        </section>

        <div className="mt-8 flex flex-col gap-4 text-base text-on-surface-variant">
          <p>
            Not sure which of our sizes you want?{" "}
            <Link href="/#shop" className="underline hover:text-action-red">
              Look at what we frame
            </Link>{" "}
            and bring the name of the size with you.
          </p>
          <p>
            Asking about an order you have already placed?{" "}
            <Link href="/orders" className="underline hover:text-action-red">
              Open your orders
            </Link>{" "}
            and quote the order reference - it is on the confirmation email and
            on the order page.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
