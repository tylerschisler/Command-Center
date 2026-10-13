import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { navigation } from "@/components/app-shell";
import { MyWorkWorkspace, ProjectsWorkspace } from "@/components/work/workspaces";
import { PeopleWorkspace, WaitingOnWorkspace } from "@/components/relationships/workspaces";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { KnowledgeWorkspace } from "@/components/knowledge/knowledge-workspace";
import { AiSettingsWorkspace } from "@/components/jarvis/ai-settings-workspace";

export function generateStaticParams() { return navigation.filter(([, href]) => href !== "/").map(([, href]) => ({ section: href.slice(1) })); }

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = navigation.find(([, href]) => href === `/${section}`);
  if (!item) notFound();
  if (section === "my-work") return <MyWorkWorkspace />;
  if (section === "projects") return <ProjectsWorkspace />;
  if (section === "people") return <PeopleWorkspace />;
  if (section === "waiting-on") return <WaitingOnWorkspace />;
  if (section === "calendar") return <CalendarWorkspace />;
  if (section === "knowledge") return <KnowledgeWorkspace />;
  if (section === "settings") return <AiSettingsWorkspace />;
  return <div className="page"><div className="eyebrow">Workspace</div><h1>{item[0]}</h1><p className="lede">This area is intentionally reserved for a later roadmap phase.</p><Card><span className="status-pill">Foundation ready</span><h2>No placeholder data</h2><p>Real workflows will be added when their phase begins.</p></Card></div>;
}
