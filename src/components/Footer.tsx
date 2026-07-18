import Link from "next/link";

/** Site footer. Inverted (black) block per the brutalist stark-overlay rule. */
export function Footer() {
  return (
    <footer className="mt-16 bg-primary text-on-primary">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-black">FRAMERS LAB</p>
          <p className="label-caps mt-1 text-inverse-primary">
            Custom poster frames · India
          </p>
        </div>
        <div className="flex gap-6">
          <Link href="/privacy" className="label-caps hover:text-neon-accent">
            Privacy
          </Link>
          <Link href="/terms" className="label-caps hover:text-neon-accent">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
