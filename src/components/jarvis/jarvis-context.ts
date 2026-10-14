"use client";
import type { JarvisPageContext } from "@/domain/jarvis";
export const JARVIS_CONTEXT_EVENT = "command-center:jarvis-context";
export const JARVIS_OPEN_EVENT = "command-center:jarvis-open";
export function publishJarvisContext(context: JarvisPageContext) { window.dispatchEvent(new CustomEvent(JARVIS_CONTEXT_EVENT, { detail: context })); }
export function clearJarvisContext() { window.dispatchEvent(new CustomEvent(JARVIS_CONTEXT_EVENT, { detail: null })); }
export function openJarvis() { window.dispatchEvent(new CustomEvent(JARVIS_OPEN_EVENT)); }
