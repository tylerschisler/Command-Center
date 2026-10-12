import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = { title: "Command Center", description: "Local-first personal work command center" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
