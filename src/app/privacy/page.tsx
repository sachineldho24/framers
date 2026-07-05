import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata = { title: "Privacy Policy — Framers" };

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-3xl">Privacy Policy</h1>
        <p className="label-caps mt-2 text-on-surface-variant">
          Placeholder — finalise before launch (see plan/08 Q-8)
        </p>
        <div className="mt-8 flex flex-col gap-4 text-base text-on-surface-variant">
          <p>
            We collect the information needed to fulfil your order: your email,
            delivery address, phone number, and the design you create. Payments
            are processed by Razorpay; we do not store your card or UPI details.
          </p>
          <p>
            When you design a frame, you authorise our app to create and export
            designs in your Canva account on your behalf. We store the exported
            design files so we can print and deliver your order.
          </p>
          <p>
            We do not sell your data. Contact us via Instagram for any
            data-related requests.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
