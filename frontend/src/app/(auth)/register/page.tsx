"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/AuthCard";
import { ErrorAlert, Field } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const problems: Record<string, string> = {};
    if (!name.trim()) problems.name = "Name is required";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = "Enter a valid email address";
    if (password.length < 8) problems.password = "Password must be at least 8 characters";
    setFieldErrors(problems);
    if (Object.keys(problems).length) return;

    setSubmitting(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof ApiError ? err.message : "Could not create the account");
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Start organizing your projects with TaskFlow">
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorAlert message={error} />}
        <Field label="Name" htmlFor="name" error={fieldErrors.name}>
          <input
            id="name"
            className="input"
            autoComplete="name"
            value={name}
            aria-invalid={!!fieldErrors.name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email address" htmlFor="email" error={fieldErrors.email}>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            aria-invalid={!!fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password}>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            value={password}
            aria-invalid={!!fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}
