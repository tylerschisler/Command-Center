import Link from "next/link";
import type { ReactNode } from "react";
import { JarvisSurface } from "@/components/jarvis/jarvis-surface";
import { StartupBackupCheck } from "@/components/backups/startup-backup-check";
import { PrimaryNavigation } from "@/components/primary-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <StartupBackupCheck />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Command Center home"><span aria-hidden="true">C</span><strong>Command Center</strong></Link>
        <PrimaryNavigation />
        <div className="local-status"><span aria-hidden="true" /> Local workspace</div>
      </aside>
      <div className="workspace">
        <header className="topbar"><p>Personal operations</p><JarvisSurface /></header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
