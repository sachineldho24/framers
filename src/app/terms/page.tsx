import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Terms of Service — Framers" };

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-3xl">Terms of Service</h1>
        <p className="label-caps mt-2 text-on-surface-variant">
          Placeholder — finalise before launch (see plan/08 Q-8)
        </p>
        <div className="mt-8 flex flex-col gap-4 text-base text-on-surface-variant">
          <p>
            Framers prints and delivers custom poster frames based on designs you
            create. By placing an order you confirm you have the right to use the
            content in your design.
          </p>
          <p>
            Because every frame is made to order from your own design, orders
            cannot be cancelled or refunded once production has started, except
            where the product is defective or damaged in transit.
          </p>
          <p>
            Delivery timelines are estimates. Contact us via Instagram for any
            order issues.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
