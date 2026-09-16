import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

/** Site footer, using the same black surface as the storefront. */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-outline-variant bg-background text-on-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" aria-label="Framers Lab home" className="inline-flex min-h-11 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-accent">
            <BrandLogo className="w-[232px]" />
          </Link>
          <p className="label-caps mt-3 text-inverse-primary">
            Custom poster frames · India
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <Link href="/works" className="label-caps hover:text-neon-accent">
            Our Works
          </Link>
          <Link href="/privacy" className="label-caps hover:text-neon-accent">
            Privacy
          </Link>
          <Link href="/terms" className="label-caps hover:text-neon-accent">
            Terms
          </Link>
          <Link href="/contact" className="label-caps hover:text-neon-accent">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
