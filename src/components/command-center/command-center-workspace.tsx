"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { labels } from "@/domain/work";

type Item = { id: string; title: string; href: string; reasons: string[]; entityType: string; score: number };
type Dashboard = {
  date: string; timeZone: string;
  summary: { dueToday: number; overdueTasks: number; meetingsToday: number; openRequests: number; projectsAtRisk: number };
  todayWork: Array<{ id: string; title: string; projectName: string | null; priority: string; targetDate: string | null; dueDate: string | null; status: string; ownerName: string }>;
  attention: Item[]; focus: Item[];
  waitingOn: Array<{ id: string; title: string; personName: string; projectName: string | null; dueDate: string; followUpDate: string | null; status: string }>;
  meetings: Array<{ id: string; title: string; startDateTime: string; attendees: string[]; projectName: string | null; status: string }>;
  projectHealth: Array<{ id: string; name: string; health: string; status: string; targetDate: string | null; dueDate: string | null; overdueTaskCount: number; openRequestCount: number; progress: { percent: number; totalTasks: number } }>;
  intelligence: Array<{ id: string; headline: string; sourceName: string; sourceUrl: string; publicationDate: string; relevanceScore: number; whyItMatters: string }>;
};
type Briefing = { id: string; type: string; title: string; periodStart: string; periodEnd: string; renderedContent: string; generatedAt: string; aiGenerated: boolean };

function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; }
function dateLabel(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`)) : "—"; }
function human(value: string) { return (labels as Record<string, string>)[value] ?? value.replaceAll("_", " "); }

export function CommandCenterWorkspace() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selected, setSelected] = useState<Briefing | null>(null);
  const [briefingFilter, setBriefingFilter] = useState("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const context = { today: localDate(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const load = useCallback(async () => {
    setError("");
    try {
      const [dashboardResponse, briefingResponse] = await Promise.all([fetch(`/api/command-center?today=${context.today}&timeZone=${encodeURIComponent(context.timeZone)}`, { cache: "no-store" }), fetch("/api/briefings", { cache: "no-store" })]);
      const dashboardBody = await dashboardResponse.json(); const briefingBody = await briefingResponse.json();
      if (!dashboardResponse.ok) throw new Error(dashboardBody.error ?? "Could not load Command Center.");
      if (!briefingResponse.ok) throw new Error(briefingBody.error ?? "Could not load briefings.");
      setDashboard(dashboardBody.dashboard); setBriefings(briefingBody.briefings);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load Command Center."); }
  }, [context.timeZone, context.today]);
  useEffect(() => {
    void Promise.all([fetch(`/api/command-center?today=${context.today}&timeZone=${encodeURIComponent(context.timeZone)}`, { cache: "no-store" }), fetch("/api/briefings", { cache: "no-store" })]).then(async ([dashboardResponse, briefingResponse]) => {
      const dashboardBody = await dashboardResponse.json(); const briefingBody = await briefingResponse.json();
      if (!dashboardResponse.ok) throw new Error(dashboardBody.error ?? "Could not load Command Center.");
      if (!briefingResponse.ok) throw new Error(briefingBody.error ?? "Could not load briefings.");
      setDashboard(dashboardBody.dashboard); setBriefings(briefingBody.briefings);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load Command Center."));
  }, [context.timeZone, context.today]);
  async function generate(type: "morning" | "end_of_day" | "weekly") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/briefings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, ...context }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not generate briefing.");
      setSelected(body.briefing); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate briefing."); } finally { setBusy(false); }
  }
  if (!dashboard && !error) return <div className="empty-state" role="status">Loading your Command Center…</div>;
  if (!dashboard) return <div className="form-error" role="alert">{error}<br /><button className="button-secondary compact" onClick={() => void load()}>Try again</button></div>;
  const metrics = [["Tasks due today", dashboard.summary.dueToday], ["Overdue tasks", dashboard.summary.overdueTasks], ["Meetings today", dashboard.summary.meetingsToday], ["Open requests", dashboard.summary.openRequests], ["Projects at risk", dashboard.summary.projectsAtRisk]];
  return <div className="command-center-page">
    <header className="page-header"><div><div className="eyebrow">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dashboard.date}T12:00:00`))}</div><h1>Command Center</h1><p className="lede">A focused view of what deserves your attention today.</p></div><div className="briefing-actions" role="group" aria-label="Briefing generation"><button disabled={busy} onClick={() => void generate("morning")}>Morning Briefing</button><button className="button-secondary" disabled={busy} onClick={() => void generate("end_of_day")}>End of Day</button><button className="button-secondary" disabled={busy} onClick={() => void generate("weekly")}>Weekly Review</button></div></header>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section aria-labelledby="summary-heading"><h2 className="sr-only" id="summary-heading">Today at a glance</h2><div className="metric-grid">{metrics.map(([label, count]) => <div className="metric-card" key={label}><strong>{count}</strong><span>{label}</span></div>)}</div></section>
    <div className="command-grid">
      <section className="command-panel span-two" aria-labelledby="today-work"><div className="section-heading"><h2 id="today-work">Today&apos;s Work</h2><Link href="/my-work">Open My Work</Link></div>{dashboard.todayWork.length ? <ul className="dashboard-list">{dashboard.todayWork.map((task) => <li key={task.id}><div><strong>{task.title}</strong><small>{task.projectName ?? "Independent"} · {task.ownerName}</small></div><div><span className={`badge ${task.priority}`}>{human(task.priority)}</span><span className={`badge ${task.status}`}>{human(task.status)}</span></div><small>Target {dateLabel(task.targetDate)} · Due {dateLabel(task.dueDate)}</small></li>)}</ul> : <p className="panel-empty">No open tasks are overdue, due today, targeting today, or high priority and due soon.</p>}</section>
      <section className="command-panel focus-panel" aria-labelledby="focus"><div className="section-heading"><h2 id="focus">Focus</h2><span>Deterministic</span></div>{dashboard.focus.length ? <ol className="focus-list">{dashboard.focus.map((item) => <li key={`${item.entityType}:${item.id}`}><Link href={item.href}>{item.title}</Link><small>{item.reasons.join(" · ")}</small></li>)}</ol> : <p className="panel-empty">No focus recommendations right now.</p>}</section>
      <section className="command-panel span-two" aria-labelledby="attention"><div className="section-heading"><h2 id="attention">Attention Needed</h2></div>{dashboard.attention.length ? <ul className="dashboard-list compact-list">{dashboard.attention.map((item) => <li key={`${item.entityType}:${item.id}`}><Link href={item.href}><strong>{item.title}</strong></Link><span className="entity-label">{item.entityType}</span><small>{item.reasons.join(" · ")}</small></li>)}</ul> : <p className="panel-empty">Nothing currently meets an attention rule.</p>}</section>
      <section className="command-panel" aria-labelledby="waiting"><div className="section-heading"><h2 id="waiting">Waiting On</h2><Link href="/waiting-on">View all</Link></div>{dashboard.waitingOn.length ? <ul className="simple-list">{dashboard.waitingOn.map((request) => <li key={request.id}><Link href="/waiting-on"><strong>{request.title}</strong></Link><small>{request.personName}{request.projectName ? ` · ${request.projectName}` : ""}</small><span>Due {dateLabel(request.dueDate)}{request.followUpDate ? ` · Follow up ${dateLabel(request.followUpDate)}` : ""}</span></li>)}</ul> : <p className="panel-empty">No open requests.</p>}</section>
      <section className="command-panel" aria-labelledby="meetings"><div className="section-heading"><h2 id="meetings">Today&apos;s Meetings</h2><Link href="/calendar">Open Calendar</Link></div>{dashboard.meetings.length ? <ul className="simple-list">{dashboard.meetings.map((meeting) => <li key={meeting.id}><Link href="/calendar"><strong><time dateTime={meeting.startDateTime}>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(meeting.startDateTime))}</time> · {meeting.title}</strong></Link><small>{meeting.attendees.length ? meeting.attendees.join(", ") : "No attendees"}{meeting.projectName ? ` · ${meeting.projectName}` : ""}</small><span>{human(meeting.status)}</span></li>)}</ul> : <p className="panel-empty">No meetings scheduled today.</p>}</section>
      <section className="command-panel span-two" aria-labelledby="health"><div className="section-heading"><h2 id="health">Project Health</h2><Link href="/projects">View Projects</Link></div>{dashboard.projectHealth.length ? <div className="health-grid">{dashboard.projectHealth.map((project) => <Link className="health-card" href="/projects" key={project.id}><div><strong>{project.name}</strong><span className={`badge ${project.health}`}>{human(project.health)}</span></div><div className="progress" aria-label={`${project.progress.percent}% complete`}><span style={{ width: `${project.progress.percent}%` }} /></div><small>{project.progress.totalTasks ? `${project.progress.percent}% complete` : "No tasks"} · {project.overdueTaskCount} overdue task(s) · {project.openRequestCount} open request(s)</small><span>Target {dateLabel(project.targetDate)} · Due {dateLabel(project.dueDate)}</span></Link>)}</div> : <p className="panel-empty">No active projects currently meet a health or deadline warning rule.</p>}</section>
      <section className="command-panel span-two" aria-labelledby="intelligence"><div className="section-heading"><h2 id="intelligence">GRC Intelligence</h2><Link href="/intelligence">Open Intelligence</Link></div>{dashboard.intelligence.length ? <ul className="simple-list">{dashboard.intelligence.map((item) => <li key={item.id}><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"><strong>{item.headline}</strong></a><small>{item.sourceName} · Relevance {item.relevanceScore}</small><span>{item.whyItMatters}</span></li>)}</ul> : <p className="panel-empty">No meaningful recent intelligence is stored. Refresh trusted sources from Intelligence.</p>}</section>
      <section className="command-panel briefing-library" aria-labelledby="library"><div className="section-heading"><h2 id="library">Briefing Library</h2></div><div className="library-filters" aria-label="Briefing type filters">{[["all","All"],["morning","Morning"],["end_of_day","End of Day"],["weekly","Weekly"]].map(([value,label]) => <button key={value} className={briefingFilter === value ? "active" : ""} aria-pressed={briefingFilter === value} onClick={() => setBriefingFilter(value)}>{label}</button>)}</div>{briefings.filter((item) => briefingFilter === "all" || item.type === briefingFilter).length ? <ul className="simple-list">{briefings.filter((item) => briefingFilter === "all" || item.type === briefingFilter).map((briefing) => <li key={briefing.id}><button className="text-button" onClick={() => setSelected(briefing)}>{briefing.title}</button><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(briefing.generatedAt))}</small></li>)}</ul> : <p className="panel-empty">{briefings.length ? "No saved briefings of this type." : "Generate your first fact-based briefing above."}</p>}</section>
    </div>
    {selected && <aside className="briefing-drawer" aria-labelledby="briefing-title"><div className="editor-heading"><div><span className="eyebrow">Saved briefing</span><h2 id="briefing-title">{selected.title}</h2></div><button className="button-secondary" onClick={() => setSelected(null)} aria-label="Close briefing">Close</button></div><p className="field-help">Deterministic facts · No AI used</p><pre>{selected.renderedContent}</pre></aside>}
  </div>;
}
