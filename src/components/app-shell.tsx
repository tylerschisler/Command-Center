import Link from "next/link";
import type { ReactNode } from "react";

export const navigation = [
  ["Home", "/"], ["My Work", "/my-work"], ["Projects", "/projects"],
  ["Waiting On", "/waiting-on"], ["Calendar", "/calendar"], ["People", "/people"],
  ["Knowledge", "/knowledge"], ["Intelligence", "/intelligence"], ["Settings", "/settings"],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Command Center home"><span aria-hidden="true">C</span><strong>Command Center</strong></Link>
        <nav aria-label="Primary navigation">
          <ul>{navigation.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
        </nav>
        <div className="local-status"><span aria-hidden="true" /> Local workspace</div>
      </aside>
      <div className="workspace">
        <header className="topbar"><p>Personal operations</p><kbd>⌘ K</kbd></header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
