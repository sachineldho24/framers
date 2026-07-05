import type { Metadata } from "next";
import { DetailTopBar } from "@/components/DetailTopBar";
import { CheckoutClient } from "@/components/CheckoutClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout — Framers" };

export default function CheckoutPage() {
  return (
    <>
      <DetailTopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-margin-mobile pb-32 pt-24">
        <CheckoutClient />
      </main>
    </>
  );
}
