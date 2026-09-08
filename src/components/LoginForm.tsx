"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postAuthDestination, type AuthMode } from "@/lib/auth-redirect";
import { Icon } from "@/components/Icon";

type Mode = AuthMode;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

    // Hard navigation (not router.push): a full document load guarantees the
    // server reads the auth cookie just written by signInWithPassword. A soft
    // navigation races cookie propagation (and the proxy's getUser() session
    // refresh), which left the form stuck on "Please wait…" until a manual
    // refresh. See Supabase SSR + App Router auth timing.
    //
    // It is also what makes the storefront header pick the new session up on
    // arrival, so a fresh account sees its own profile immediately.
    window.location.assign(postAuthDestination(mode, next));
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
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant transition-colors hover:text-primary"
            >
              <Icon name={showPassword ? "visibility" : "visibility_off"} />
            </button>
          </div>
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
