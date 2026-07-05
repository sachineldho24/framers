import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
