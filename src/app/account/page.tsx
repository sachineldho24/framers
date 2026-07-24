import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getCurrentUser } from "@/lib/auth-server";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account — Framers" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-3xl">Account</h1>
        <p className="label-caps mt-2 text-on-surface-variant">{user.email}</p>

        <section className="mt-8 border-2 border-black bg-white p-6">
          <h2 className="text-[22px] uppercase">Session</h2>
          <p className="mt-3 text-base text-on-surface-variant">
            Signed in as {user.email}.
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
