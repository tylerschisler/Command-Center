"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { calendarToday, labels, PRIORITIES, PROJECT_HEALTH, PROJECT_STATUSES, TASK_STATUSES } from "@/domain/work";
import { WaitingOnWorkspace } from "@/components/relationships/workspaces";
import { MeetingsPanel } from "@/components/calendar/calendar-workspace";

type TaskItem = {
  id: string; title: string; description: string; status: (typeof TASK_STATUSES)[number]; priority: (typeof PRIORITIES)[number];
  ownerId: string | null; projectId: string | null; startDate: string | null; targetDate: string | null; dueDate: string | null;
  completedDate: string | null; recurrenceRuleId: string | null; estimatedEffort: number | null; createdAt: string; updatedAt: string;
  archivedAt: string | null; targetAfterDue: boolean; overdue: boolean; ownerName: string | null; unresolvedOwnership: boolean;
};
type PersonItem = { id: string; displayName: string };
type ProjectItem = {
  id: string; name: string; description: string; status: (typeof PROJECT_STATUSES)[number]; health: (typeof PROJECT_HEALTH)[number];
  priority: (typeof PRIORITIES)[number]; ownerId: string | null; startDate: string | null; targetDate: string | null;
  dueDate: string | null; completedDate: string | null; archivedAt: string | null; targetAfterDue: boolean; overdue: boolean;
  progress: { totalTasks: number; completedTasks: number; openTasks: number; percent: number }; overdueTaskCount: number;
};
type ActivityItem = { id: string; eventType: string; description: string; timestamp: string };
type ProjectDetail = ProjectItem & { tasks: TaskItem[]; activity: ActivityItem[] };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}

function dateText(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—"; }
function Badge({ value, tone }: { value: string; tone?: string }) { return <span className={`badge ${tone ?? value}`}>{labels[value as keyof typeof labels] ?? value}</span>; }
function Risk({ targetAfterDue, overdue }: { targetAfterDue: boolean; overdue: boolean }) {
  if (!targetAfterDue && !overdue) return null;
  return <div className="risk" role="status">{targetAfterDue ? "Target completion is after required due date." : "Required due date has passed."}</div>;
}

function TaskForm({ task, projects, people, projectId, onSaved, onCancel }: {
  task?: TaskItem; projects: ProjectItem[]; people: PersonItem[]; projectId?: string; onSaved: () => void; onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get("title"), description: form.get("description"), status: form.get("status"), priority: form.get("priority"),
      ownerId: String(form.get("ownerId") || "") || null,
      projectId: String(form.get("projectId") || "") || null,
      startDate: String(form.get("startDate") || "") || null, targetDate: String(form.get("targetDate") || "") || null,
      dueDate: String(form.get("dueDate") || "") || null,
      estimatedEffort: form.get("estimatedEffort") ? Number(form.get("estimatedEffort")) : null,
    };
    try {
      await api(task ? `/api/tasks/${task.id}` : "/api/tasks", { method: task ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save task."); }
    finally { setSaving(false); }
  }
  return <form className="editor-form" onSubmit={submit}>
    <div className="editor-heading"><div><span className="eyebrow">Task</span><h2>{task ? "Edit task" : "New task"}</h2></div><button type="button" className="button-secondary" onClick={onCancel}>Close</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label>Title<input name="title" defaultValue={task?.title} required maxLength={200} autoFocus /></label>
    <label>Description<textarea name="description" defaultValue={task?.description} rows={3} maxLength={10000} /></label>
    <div className="form-grid">
      <label>Status<select name="status" defaultValue={task?.status ?? "not_started"}>{TASK_STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Priority<select name="priority" defaultValue={task?.priority ?? "medium"}>{PRIORITIES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Owner<select name="ownerId" defaultValue={task?.ownerId ?? ""}><option value="">Mine</option>{task?.unresolvedOwnership && <option value="" disabled>Unresolved legacy owner — choose a person</option>}{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select>{task?.unresolvedOwnership && <small className="risk">Legacy delegated owner needs reassignment.</small>}</label>
      <label>Project<select name="projectId" defaultValue={task?.projectId ?? projectId ?? ""}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label>Start date<input name="startDate" type="date" defaultValue={task?.startDate ?? ""} /></label>
      <label>Target date <small>Planned</small><input name="targetDate" type="date" defaultValue={task?.targetDate ?? ""} /></label>
      <label>Due date <small>Required</small><input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} /></label>
      <label>Estimated effort <small>minutes</small><input name="estimatedEffort" type="number" min="0" defaultValue={task?.estimatedEffort ?? ""} /></label>
    </div>
    <button disabled={saving}>{saving ? "Saving…" : "Save task"}</button>
  </form>;
}

function ProjectForm({ project, onSaved, onCancel }: { project?: ProjectItem; onSaved: (id?: string) => void; onCancel: () => void }) {
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), description: form.get("description"), status: form.get("status"), health: form.get("health"), priority: form.get("priority"),
      startDate: String(form.get("startDate") || "") || null, targetDate: String(form.get("targetDate") || "") || null, dueDate: String(form.get("dueDate") || "") || null };
    try {
      const result = await api<{ project: ProjectItem }>(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved(result.project.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save project."); }
    finally { setSaving(false); }
  }
  return <form className="editor-form" onSubmit={submit}>
    <div className="editor-heading"><div><span className="eyebrow">Project</span><h2>{project ? "Edit project" : "New project"}</h2></div><button type="button" className="button-secondary" onClick={onCancel}>Close</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <label>Name<input name="name" defaultValue={project?.name} required maxLength={200} autoFocus /></label>
    <label>Description<textarea name="description" defaultValue={project?.description} rows={3} maxLength={10000} /></label>
    <div className="form-grid">
      <label>Status<select name="status" defaultValue={project?.status ?? "planning"}>{PROJECT_STATUSES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Health<select name="health" defaultValue={project?.health ?? "on_track"}>{PROJECT_HEALTH.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Priority<select name="priority" defaultValue={project?.priority ?? "medium"}>{PRIORITIES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <label>Start date<input name="startDate" type="date" defaultValue={project?.startDate ?? ""} /></label>
      <label>Target date <small>Planned</small><input name="targetDate" type="date" defaultValue={project?.targetDate ?? ""} /></label>
      <label>Due date <small>Required</small><input name="dueDate" type="date" defaultValue={project?.dueDate ?? ""} /></label>
    </div><button disabled={saving}>{saving ? "Saving…" : "Save project"}</button>
  </form>;
}

export function MyWorkWorkspace() {
  const [tasks, setTasks] = useState<TaskItem[]>([]); const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [filter, setFilter] = useState("all"); const [editing, setEditing] = useState<TaskItem | "new" | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading"); const [error, setError] = useState("");
  const load = useCallback(async () => { try { const [taskData, projectData, peopleData] = await Promise.all([api<{ tasks: TaskItem[] }>("/api/tasks"), api<{ projects: ProjectItem[] }>("/api/projects"), api<{ people: PersonItem[] }>("/api/people")]); setTasks(taskData.tasks); setProjects(projectData.projects); setPeople(peopleData.people); setState("ready"); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load tasks."); setState("error"); } }, []);
  useEffect(() => {
    void Promise.all([api<{ tasks: TaskItem[] }>("/api/tasks"), api<{ projects: ProjectItem[] }>("/api/projects"), api<{ people: PersonItem[] }>("/api/people")])
      .then(([taskData, projectData, peopleData]) => { setTasks(taskData.tasks); setProjects(projectData.projects); setPeople(peopleData.people); setState("ready"); })
      .catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : "Unable to load tasks."); setState("error"); });
  }, []);
  const today = calendarToday();
  const shown = useMemo(() => tasks.filter((task) => filter === "all" || (filter === "mine" && !task.ownerId && !task.unresolvedOwnership) || (filter === "delegated" && Boolean(task.ownerId)) || (filter === "completed" && task.status === "completed") || (filter === "today" && task.status !== "completed" && (task.targetDate === today || task.dueDate === today)) || (filter === "upcoming" && task.status !== "completed" && Boolean((task.targetDate && task.targetDate > today) || (task.dueDate && task.dueDate > today)))), [filter, tasks, today]);
  async function complete(task: TaskItem) { try { await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ action: "complete" }) }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to complete task."); } }
  return <div className="page work-page"><div className="page-header"><div><div className="eyebrow">Execution</div><h1>My Work</h1><p className="lede">Plan with target dates. Commit with due dates.</p></div><button onClick={() => setEditing("new")}>Create task</button></div>
    <div className="filter-tabs" role="tablist" aria-label="Task views">{["all","mine","delegated","today","upcoming","completed"].map((value) => <button role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
    {state === "loading" && <p className="empty-state" role="status">Loading tasks…</p>}{state === "error" && <p className="form-error" role="alert">{error}</p>}
    {state === "ready" && shown.length === 0 && <div className="empty-state"><h2>No tasks here</h2><p>Create a task or choose another view.</p></div>}
    {shown.length > 0 && <div className="data-table" role="table" aria-label="Tasks"><div className="table-row table-head" role="row"><span>Task</span><span>Owner</span><span>Project</span><span>Priority</span><span>Target</span><span>Due</span><span>Status</span><span /></div>{shown.map((task) => <div className="table-row" role="row" key={task.id}><div><button className="text-button" onClick={() => setEditing(task)}>{task.title}</button><Risk targetAfterDue={task.targetAfterDue} overdue={task.overdue} /></div><span>{task.ownerName ?? (task.unresolvedOwnership ? "Unresolved legacy owner" : "Mine")}</span><span>{projects.find((project) => project.id === task.projectId)?.name ?? "—"}</span><Badge value={task.priority}/><span>{dateText(task.targetDate)}</span><span>{dateText(task.dueDate)}</span><Badge value={task.status}/><span>{task.status !== "completed" && <button className="button-secondary compact" onClick={() => void complete(task)}>Complete</button>}</span></div>)}</div>}
    {editing && <aside className="editor-panel" aria-label="Task editor"><TaskForm task={editing === "new" ? undefined : editing} projects={projects} people={people} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} /></aside>}
  </div>;
}

export function ProjectsWorkspace() {
  const [projects, setProjects] = useState<ProjectItem[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null); const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [filter, setFilter] = useState("active"); const [tab, setTab] = useState("overview"); const [editingProject, setEditingProject] = useState<ProjectItem | "new" | null>(null); const [editingTask, setEditingTask] = useState<TaskItem | "new" | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const loadProjects = useCallback(async () => { try { const [data, peopleData] = await Promise.all([api<{ projects: ProjectItem[] }>("/api/projects"), api<{ people: PersonItem[] }>("/api/people")]); setProjects(data.projects); setPeople(peopleData.people); setLoading(false); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load projects."); setLoading(false); } }, []);
  const loadDetail = useCallback(async (id: string) => { try { const data = await api<{ project: ProjectDetail }>(`/api/projects/${id}`); setDetail(data.project); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load project."); } }, []);
  useEffect(() => {
    void Promise.all([api<{ projects: ProjectItem[] }>("/api/projects"), api<{ people: PersonItem[] }>("/api/people")])
      .then(([data, peopleData]) => { setProjects(data.projects); setPeople(peopleData.people); setLoading(false); })
      .catch((caught: unknown) => { setError(caught instanceof Error ? caught.message : "Unable to load projects."); setLoading(false); });
  }, []);
  const shown = projects.filter((project) => filter === "all" || project.status === filter || (filter === "active" && ["active","on_hold"].includes(project.status)));
  async function completeTask(task: TaskItem) { await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ action: "complete" }) }); if (selectedId) await loadDetail(selectedId); await loadProjects(); }
  return <div className="page work-page"><div className="page-header"><div><div className="eyebrow">Portfolio</div><h1>Projects</h1><p className="lede">Track commitments, task progress, and schedule risk.</p></div><button onClick={() => setEditingProject("new")}>Create project</button></div>
    <div className="filter-tabs" role="tablist" aria-label="Project views">{["active","planning","completed","all"].map((value) => <button role="tab" aria-selected={filter === value} className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}{loading && <p className="empty-state" role="status">Loading projects…</p>}
    {!loading && shown.length === 0 && <div className="empty-state"><h2>No projects in this view</h2><p>Create a project or choose another filter.</p></div>}
    {shown.length > 0 && <div className="project-grid">{shown.map((project) => <button className={`project-card ${selectedId === project.id ? "selected" : ""}`} key={project.id} onClick={() => { setSelectedId(project.id); setTab("overview"); void loadDetail(project.id); }}><div><Badge value={project.health}/><Badge value={project.status}/></div><h2>{project.name}</h2><Risk targetAfterDue={project.targetAfterDue} overdue={project.overdue}/><div className="progress"><span style={{ width: `${project.progress.percent}%` }} /></div><p>{project.progress.totalTasks ? `${project.progress.percent}% · ${project.progress.completedTasks}/${project.progress.totalTasks} tasks` : "No tasks"}</p><dl><div><dt>Target</dt><dd>{dateText(project.targetDate)}</dd></div><div><dt>Due</dt><dd>{dateText(project.dueDate)}</dd></div></dl></button>)}</div>}
    {detail && <section className="project-detail" aria-label={`${detail.name} details`}><div className="detail-title"><div><span className="eyebrow">Project detail</span><h2>{detail.name}</h2></div><button className="button-secondary" onClick={() => setEditingProject(detail)}>Edit project</button></div><Risk targetAfterDue={detail.targetAfterDue} overdue={detail.overdue}/>
      <div className="filter-tabs" role="tablist" aria-label="Project detail views">{["overview","tasks","waiting-on","meetings","activity"].map((value) => <button role="tab" aria-selected={tab===value} className={tab===value?"active":""} key={value} onClick={() => setTab(value)}>{value === "waiting-on" ? "Waiting On" : value[0].toUpperCase()+value.slice(1)}</button>)}</div>
      {tab === "overview" && <div className="overview-grid"><div><span>Status</span><Badge value={detail.status}/></div><div><span>Health</span><Badge value={detail.health}/></div><div><span>Priority</span><Badge value={detail.priority}/></div><div><span>Start</span><strong>{dateText(detail.startDate)}</strong></div><div><span>Target · planned</span><strong>{dateText(detail.targetDate)}</strong></div><div><span>Due · required</span><strong>{dateText(detail.dueDate)}</strong></div><div><span>Progress</span><strong>{detail.progress.totalTasks ? `${detail.progress.percent}%` : "No tasks"}</strong></div><div><span>Open tasks</span><strong>{detail.progress.openTasks}</strong></div><div><span>Completed tasks</span><strong>{detail.progress.completedTasks}</strong></div><div><span>Overdue tasks</span><strong>{detail.overdueTaskCount}</strong></div></div>}
      {tab === "tasks" && <div><div className="section-actions"><h3>Project tasks</h3><button onClick={() => setEditingTask("new")}>Add task</button></div>{detail.tasks.length === 0 ? <p className="empty-state">No tasks in this project.</p> : <ul className="detail-list">{detail.tasks.map((task) => <li key={task.id}><div><button className="text-button" onClick={() => setEditingTask(task)}>{task.title}</button><Risk targetAfterDue={task.targetAfterDue} overdue={task.overdue}/></div><Badge value={task.status}/>{task.status !== "completed" && <button className="button-secondary compact" onClick={() => void completeTask(task)}>Complete</button>}</li>)}</ul>}</div>}
      {tab === "waiting-on" && <WaitingOnWorkspace projectId={detail.id} />}
      {tab === "meetings" && <MeetingsPanel projectId={detail.id} />}
      {tab === "activity" && (detail.activity.length ? <ul className="activity-list">{detail.activity.map((item) => <li key={item.id}><strong>{item.description}</strong><time>{new Date(item.timestamp).toLocaleString()}</time></li>)}</ul> : <p className="empty-state">No activity recorded.</p>)}
    </section>}
    {editingProject && <aside className="editor-panel" aria-label="Project editor"><ProjectForm project={editingProject === "new" ? undefined : editingProject} onCancel={() => setEditingProject(null)} onSaved={(id) => { setEditingProject(null); void loadProjects(); if (id) { setSelectedId(id); void loadDetail(id); } }} /></aside>}
    {editingTask && detail && <aside className="editor-panel" aria-label="Task editor"><TaskForm task={editingTask === "new" ? undefined : editingTask} projects={projects} people={people} projectId={detail.id} onCancel={() => setEditingTask(null)} onSaved={() => { setEditingTask(null); void loadDetail(detail.id); void loadProjects(); }} /></aside>}
  </div>;
}
