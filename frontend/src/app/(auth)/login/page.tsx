"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorAlert, Field } from "@/components/ui";
import { useAuth, useRedirectIfSignedIn } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  useRedirectIfSignedIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to your TaskFlow account">
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorAlert message={error} />}
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="alex@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        Don&apos;t have an account? <Link href="/register">Create account</Link>
      </p>
    </AuthCard>
  );
}
