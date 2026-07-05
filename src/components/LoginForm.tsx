"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is on, there's no session yet.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  const inputCls =
    "w-full border-2 border-primary bg-surface-lowest px-3 py-3 outline-none focus:border-action-red";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>
        <p className="label-caps mt-2 text-on-surface-variant">
          {mode === "signin"
            ? "Welcome back"
            : "Start designing your frame"}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex border-2 border-primary">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`label-caps flex-1 cursor-pointer py-3 ${
            mode === "signin"
              ? "bg-primary text-on-primary"
              : "bg-surface-lowest"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`label-caps flex-1 cursor-pointer py-3 ${
            mode === "signup"
              ? "bg-primary text-on-primary"
              : "bg-surface-lowest"
          }`}
        >
          Sign Up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="label-caps">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="label-caps">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
        </label>

        {error && (
          <p className="label-caps border-2 border-error px-3 py-2 text-error">
            {error}
          </p>
        )}
        {info && (
          <p className="label-caps border-2 border-primary px-3 py-2">{info}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="label-caps cursor-pointer bg-action-red px-6 py-4 text-on-primary transition-colors hover:bg-primary disabled:opacity-60"
        >
          {loading
            ? "Please wait…"
            : mode === "signin"
              ? "Sign In"
              : "Create Account"}
        </button>
      </form>
    </div>
  );
}
