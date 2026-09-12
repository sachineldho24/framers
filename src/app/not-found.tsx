import Link from "next/link";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-margin-mobile py-section">
        <p className="label-caps text-neon-accent">404</p>
        <h1 className="mt-4 text-3xl sm:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-md text-on-surface-variant">
          This page may have moved or is no longer available.
        </p>
        <Link
          href="/"
          className="label-caps mt-8 inline-flex min-h-12 items-center border-2 border-border-high-contrast bg-primary px-6 text-on-primary transition-colors hover:bg-action-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action-red"
        >
          Back to Framers
        </Link>
      </main>
      <Footer />
    </>
  );
}
