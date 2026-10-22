"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark">T</span>TaskFlow
      </div>
      <nav className="nav" aria-label="Main">
        {LINKS.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="who">{user?.name}</div>
        <button type="button" className="btn btn-small" onClick={() => void logout()}>
          Log out
        </button>
      </div>
    </aside>
  );
}
