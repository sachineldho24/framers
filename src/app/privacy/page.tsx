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
          Last updated: 19 July 2026
        </p>
        <div className="mt-8 flex flex-col gap-4 text-base text-on-surface-variant">
          <p>
            We collect the information needed to fulfil your order: your email,
            delivery address, phone number, and the design you upload. Payments
            are processed by Razorpay; we do not store your card or UPI details.
          </p>
          <p>
            When you upload artwork, we store the file solely to print and
            deliver your order. We do not sell your data.
          </p>
          <p>
            For any data-related requests — including access, correction, or
            deletion — contact us at{" "}
            <a
              href="https://www.instagram.com/_posterx.in"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-action-red"
            >
              @_posterx.in on Instagram
            </a>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
