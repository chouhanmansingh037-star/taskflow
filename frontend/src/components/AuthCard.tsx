import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo">
            <span className="logo-mark">T</span>TaskFlow
          </div>
          <h2>Get things done, together.</h2>
          <p>A simple workspace to manage projects, tasks, and progress.</p>
        </div>
        <div className="auth-form">
          <h1>{title}</h1>
          <p className="sub">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
