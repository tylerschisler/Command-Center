"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigation } from "@/config/navigation";

export function PrimaryNavigation() {
  const pathname = usePathname();
  const icons: Record<string, string> = { Home: "⌂", "My Work": "✓", Projects: "◇", "Waiting On": "↗", Calendar: "□", People: "◎", Knowledge: "▤", Intelligence: "⌁", Settings: "⚙" };
  return <nav aria-label="Primary navigation"><ul>{navigation.map(([label, href]) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    return <li key={href}><Link href={href} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{icons[label]}</span>{label}</Link></li>;
  })}</ul></nav>;
}
