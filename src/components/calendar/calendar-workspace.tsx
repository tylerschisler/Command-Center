"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  labels,
  MEETING_STATUSES,
  PRIORITIES,
  REQUEST_STATUSES,
  TASK_STATUSES,
  type CalendarEvent,
} from "@/domain/work";
import { KnowledgeRelationsPanel } from "@/components/knowledge/knowledge-workspace";
import {
  clearJarvisContext,
  openJarvis,
  publishJarvisContext,
} from "@/components/jarvis/jarvis-context";
import { EntityActions } from "@/components/ui/entity-actions";

type Person = { id: string; displayName: string };
type Project = { id: string; name: string };
type Decision = { id: string; content: string; createdAt: string };
type RelatedTask = { id: string; title: string; status: string };
type RelatedRequest = { id: string; title: string; status: string };
type Activity = { id: string; description: string; timestamp: string };
export type MeetingItem = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  location: string | null;
  agenda: string | null;
  notes: string | null;
  status: (typeof MEETING_STATUSES)[number];
  projectId: string | null;
  projectName: string | null;
  participants: Person[];
  archivedAt: string | null;
};
type MeetingDetail = MeetingItem & {
  decisions: Decision[];
  tasks: RelatedTask[];
  requests: RelatedRequest[];
  activity: Activity[];
};

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The request failed.");
  return body;
}
function localInput(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  return new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
function localIso(value: FormDataEntryValue | null) {
  return new Date(String(value)).toISOString();
}
function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      {labels[value as keyof typeof labels] ?? value}
    </span>
  );
}
const eventLabels = {
  meeting: "Meeting",
  target: "Target",
  due: "Due",
  follow_up: "Follow-Up",
} as const;

export function MeetingForm({
  meeting,
  people,
  projects,
  projectId,
  onSaved,
  onCancel,
}: {
  meeting?: MeetingItem;
  people: Person[];
  projects: Project[];
  projectId?: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [defaults] = useState(() => ({
    start: localInput(new Date(Date.now() + 3_600_000).toISOString()),
    end: localInput(new Date(Date.now() + 7_200_000).toISOString()),
  }));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const participantIds = form.getAll("participantIds").map(String);
    const payload = {
      title: form.get("title"),
      startDateTime: localIso(form.get("startDateTime")),
      endDateTime: localIso(form.get("endDateTime")),
      location: String(form.get("location") || "") || null,
      agenda: String(form.get("agenda") || "") || null,
      notes: String(form.get("notes") || "") || null,
      status: form.get("status"),
      projectId: String(form.get("projectId") || "") || null,
      ...(meeting ? {} : { participantIds }),
    };
    try {
      const result = await api<{ meeting: MeetingItem }>(
        meeting ? `/api/meetings/${meeting.id}` : "/api/meetings",
        { method: meeting ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      onSaved(result.meeting.id);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save meeting.",
      );
    } finally {
      setSaving(false);
    }
  }
  const defaultStart = localInput(meeting?.startDateTime) || defaults.start;
  const defaultEnd = localInput(meeting?.endDateTime) || defaults.end;
  return (
    <form className="editor-form" onSubmit={submit}>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">Meeting</span>
          <h2>{meeting ? "Edit meeting" : "New meeting"}</h2>
        </div>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Close
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <label>
        Title
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={meeting?.title}
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Starts
          <input
            name="startDateTime"
            type="datetime-local"
            required
            defaultValue={defaultStart}
          />
        </label>
        <label>
          Ends
          <input
            name="endDateTime"
            type="datetime-local"
            required
            defaultValue={defaultEnd}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={meeting?.status ?? "scheduled"}>
            {MEETING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {labels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Project
          <select
            name="projectId"
            defaultValue={meeting?.projectId ?? projectId ?? ""}
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Location
          <input name="location" defaultValue={meeting?.location ?? ""} />
        </label>
      </div>
      <label>
        Agenda
        <textarea name="agenda" rows={4} defaultValue={meeting?.agenda ?? ""} />
      </label>
      <label>
        Notes
        <textarea name="notes" rows={5} defaultValue={meeting?.notes ?? ""} />
      </label>
      {!meeting && (
        <fieldset>
          <legend>Attendees</legend>
          <div className="check-grid">
            {people.map((person) => (
              <label className="check-option" key={person.id}>
                <input
                  type="checkbox"
                  name="participantIds"
                  value={person.id}
                />
                {person.displayName}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button disabled={saving}>{saving ? "Saving…" : "Save meeting"}</button>
    </form>
  );
}

function MeetingDetailCore({
  meeting,
  people,
  onChanged,
  onEdit,
}: {
  meeting: MeetingDetail;
  people: Person[];
  onChanged: () => void;
  onEdit: () => void;
}) {
  const [error, setError] = useState("");
  const participantIds = new Set(
    meeting.participants.map((person) => person.id),
  );
  async function action(body: Record<string, unknown>) {
    try {
      await api(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update meeting.",
      );
    }
  }
  async function saveNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({ notes: form.get("notes") });
  }
  async function decision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await action({ action: "addDecision", content: form.get("content") });
    element.reset();
  }
  async function quickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await action({
      action: "quickTask",
      title: form.get("title"),
      ownerId: String(form.get("ownerId") || "") || null,
      priority: form.get("priority"),
      status: form.get("status"),
      targetDate: String(form.get("targetDate") || "") || null,
      dueDate: String(form.get("dueDate") || "") || null,
    });
    element.reset();
  }
  async function quickRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    await action({
      action: "quickRequest",
      title: form.get("title"),
      requestedFromPersonId: form.get("requestedFromPersonId"),
      priority: form.get("priority"),
      status: form.get("status"),
      dueDate: form.get("dueDate"),
      followUpDate: String(form.get("followUpDate") || "") || null,
    });
    element.reset();
  }
  return (
    <section
      className={`meeting-detail ${meeting.status === "in_progress" ? "meeting-mode" : ""}`}
      aria-label={`${meeting.title} details`}
    >
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {meeting.status === "in_progress"
              ? "Meeting mode"
              : "Meeting detail"}
          </span>
          <h2>{meeting.title}</h2>
          <p>
            {new Date(meeting.startDateTime).toLocaleString()}–
            {new Date(meeting.endDateTime).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="section-actions">
          <Badge value={meeting.status} />
          <button className="button-secondary" onClick={onEdit}>
            Edit
          </button>
          {meeting.status === "scheduled" && (
            <button onClick={() => void action({ action: "start" })}>
              Start Meeting
            </button>
          )}
          {meeting.status === "in_progress" && (
            <>
              <button className="button-secondary" onClick={openJarvis}>
                Voice command
              </button>
              <button onClick={() => void action({ action: "end" })}>
                End Meeting
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="meeting-context">
        <div>
          <span>Project</span>
          <strong>{meeting.projectName ?? "No project"}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{meeting.location ?? "—"}</strong>
        </div>
        <div>
          <span>Attendees</span>
          <strong>
            {meeting.participants
              .map((person) => person.displayName)
              .join(", ") || "None"}
          </strong>
        </div>
      </div>
      <h3>Agenda</h3>
      <p className="meeting-copy">{meeting.agenda || "No agenda recorded."}</p>
      <h3>Live notes</h3>
      <form className="stack-form" onSubmit={saveNotes}>
        <textarea
          aria-label="Meeting notes"
          name="notes"
          rows={8}
          defaultValue={meeting.notes ?? ""}
        />
        <button>Save notes</button>
      </form>
      <h3>Attendees</h3>
      <div className="participant-list">
        {meeting.participants.map((person) => (
          <span className="participant-chip" key={person.id}>
            {person.displayName}
            <button
              aria-label={`Remove ${person.displayName}`}
              onClick={() =>
                void action({
                  action: "removeParticipant",
                  personId: person.id,
                })
              }
            >
              ×
            </button>
          </span>
        ))}
        <select
          aria-label="Add attendee"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value)
              void action({
                action: "addParticipant",
                personId: event.target.value,
              });
          }}
        >
          <option value="">Add attendee…</option>
          {people
            .filter((person) => !participantIds.has(person.id))
            .map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
        </select>
      </div>
      <h3>Decisions</h3>
      <form className="inline-form" onSubmit={decision}>
        <input
          aria-label="Decision"
          name="content"
          required
          placeholder="Record a decision"
        />
        <button>Add decision</button>
      </form>
      {meeting.decisions.length ? (
        <ul className="detail-list">
          {meeting.decisions.map((item) => (
            <li key={item.id}>
              <strong>{item.content}</strong>
              <time>{new Date(item.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No decisions recorded.</p>
      )}
      <div className="meeting-actions">
        <section>
          <h3>Quick task</h3>
          <form className="stack-form" onSubmit={quickTask}>
            <label>
              Task title
              <input name="title" required />
            </label>
            <div className="form-grid">
              <label>
                Owner
                <select name="ownerId">
                  <option value="">Mine</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="medium">
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue="not_started">
                  {TASK_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Target date
                <input name="targetDate" type="date" />
              </label>
              <label>
                Due date
                <input name="dueDate" type="date" />
              </label>
            </div>
            <button>Create task</button>
          </form>
          <RelatedList items={meeting.tasks} empty="No meeting tasks." />
        </section>
        <section>
          <h3>Quick request</h3>
          <form className="stack-form" onSubmit={quickRequest}>
            <label>
              Request title
              <input name="title" required />
            </label>
            <div className="form-grid">
              <label>
                Requested from
                <select name="requestedFromPersonId" required defaultValue="">
                  <option value="">Choose a person</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="medium">
                  {PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select name="status" defaultValue="requested">
                  {REQUEST_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {labels[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input name="dueDate" type="date" required />
              </label>
              <label>
                Follow-up date
                <input name="followUpDate" type="date" />
              </label>
            </div>
            <button>Create request</button>
          </form>
          <RelatedList items={meeting.requests} empty="No meeting requests." />
        </section>
      </div>
      <h3>Activity</h3>
      {meeting.activity.length ? (
        <ul className="activity-list">
          {meeting.activity.map((item) => (
            <li key={item.id}>
              <strong>{item.description}</strong>
              <time>{new Date(item.timestamp).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No meeting activity.</p>
      )}
    </section>
  );
}
function MeetingDetailPanel(props: {
  meeting: MeetingDetail;
  people: Person[];
  onChanged: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  async function archive() {
    await api(`/api/meetings/${props.meeting.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "archive" }),
    });
    props.onDeleted();
  }
  async function remove(confirmation: string) {
    await api(`/api/meetings/${props.meeting.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmation }),
    });
    props.onDeleted();
  }
  return (
    <>
      <MeetingDetailCore {...props} />
      <div className="detail-actions">
        <EntityActions
          label={props.meeting.title}
          impact={[
            `${props.meeting.tasks.length} linked task(s) will be preserved`,
            `${props.meeting.requests.length} linked request(s) will be preserved`,
            "Meeting decisions and attendee links will be deleted",
          ]}
          onEdit={props.onEdit}
          onArchive={archive}
          onDelete={remove}
        />
      </div>
      <KnowledgeRelationsPanel
        targetType="meeting"
        targetId={props.meeting.id}
        title="Meeting knowledge"
      />
    </>
  );
}
function RelatedList({
  items,
  empty,
}: {
  items: Array<{ id: string; title: string; status: string }>;
  empty: string;
}) {
  return items.length ? (
    <ul className="detail-list">
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.title}</strong>
          <Badge value={item.status} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="empty-state">{empty}</p>
  );
}
function EventButton({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
}) {
  return (
    <button
      className={`calendar-event ${event.entityType} ${event.kind}`}
      onClick={() => onSelect(event)}
    >
      <span>
        {event.dateTime
          ? new Date(event.dateTime).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : eventLabels[event.kind]}
      </span>
      <strong>{event.title}</strong>
      <small>
        {event.entityType === "meeting"
          ? "Meeting"
          : `${event.entityType[0].toUpperCase()}${event.entityType.slice(1)} ${eventLabels[event.kind]}`}
      </small>
    </button>
  );
}

export function MeetingsPanel({ projectId }: { projectId: string }) {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [meetingData, peopleData, projectData] = await Promise.all([
        api<{ meetings: MeetingItem[] }>(
          `/api/meetings?projectId=${projectId}`,
        ),
        api<{ people: Person[] }>("/api/people"),
        api<{ projects: Project[] }>("/api/projects"),
      ]);
      setMeetings(meetingData.meetings);
      setPeople(peopleData.people);
      setProjects(projectData.projects);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load meetings.",
      );
    }
  }, [projectId]);
  useEffect(() => {
    void Promise.all([
      api<{ meetings: MeetingItem[] }>(`/api/meetings?projectId=${projectId}`),
      api<{ people: Person[] }>("/api/people"),
      api<{ projects: Project[] }>("/api/projects"),
    ])
      .then(([m, p, pr]) => {
        setMeetings(m.meetings);
        setPeople(p.people);
        setProjects(pr.projects);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "Unable to load meetings.",
        ),
      );
  }, [projectId]);
  return (
    <div>
      <div className="section-actions">
        <h3>Project meetings</h3>
        <button onClick={() => setEditing(true)}>Create meeting</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {meetings.length ? (
        <ul className="detail-list">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <div>
                <strong>{meeting.title}</strong>
                <time>{new Date(meeting.startDateTime).toLocaleString()}</time>
              </div>
              <Badge value={meeting.status} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No meetings for this project.</p>
      )}
      {editing && (
        <aside className="editor-panel" aria-label="Meeting editor">
          <MeetingForm
            people={people}
            projects={projects}
            projectId={projectId}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void load();
            }}
          />
        </aside>
      )}
    </div>
  );
}

export function CalendarWorkspace() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [editing, setEditing] = useState<MeetingItem | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [eventData, peopleData, projectData] = await Promise.all([
        api<{ events: CalendarEvent[] }>("/api/calendar"),
        api<{ people: Person[] }>("/api/people"),
        api<{ projects: Project[] }>("/api/projects"),
      ]);
      setEvents(eventData.events);
      setPeople(peopleData.people);
      setProjects(projectData.projects);
      setLoading(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load calendar.",
      );
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.all([
      api<{ events: CalendarEvent[] }>("/api/calendar"),
      api<{ people: Person[] }>("/api/people"),
      api<{ projects: Project[] }>("/api/projects"),
    ])
      .then(([e, p, pr]) => {
        setEvents(e.events);
        setPeople(p.people);
        setProjects(pr.projects);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        setError(
          caught instanceof Error ? caught.message : "Unable to load calendar.",
        );
        setLoading(false);
      });
  }, []);
  useEffect(() => {
    if (detail)
      publishJarvisContext({
        entityType: "meeting",
        entityId: detail.id,
        label: detail.title,
      });
    else clearJarvisContext();
    return clearJarvisContext;
  }, [detail]);
  async function select(event: CalendarEvent) {
    if (event.entityType === "meeting") {
      setDetail(
        (
          await api<{ meeting: MeetingDetail }>(
            `/api/meetings/${event.entityId}`,
          )
        ).meeting,
      );
      return;
    }
    window.location.assign(
      event.entityType === "task"
        ? "/my-work"
        : event.entityType === "project"
          ? "/projects"
          : "/waiting-on",
    );
  }
  async function refreshDetail() {
    if (detail)
      setDetail(
        (await api<{ meeting: MeetingDetail }>(`/api/meetings/${detail.id}`))
          .meeting,
      );
    await load();
  }
  const days = useMemo(() => {
    if (view === "day") return [new Date(anchor)];
    if (view === "week") {
      const start = addDays(anchor, -anchor.getDay());
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = addDays(start, -start.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [anchor, view]);
  const move = (direction: number) =>
    setAnchor((current) =>
      view === "month"
        ? new Date(current.getFullYear(), current.getMonth() + direction, 1)
        : addDays(current, direction * (view === "week" ? 7 : 1)),
    );
  const heading =
    view === "month"
      ? anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : view === "agenda"
        ? "Upcoming agenda"
        : view === "week"
          ? `Week of ${addDays(anchor, -anchor.getDay()).toLocaleDateString()}`
          : anchor.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
  return (
    <div className="page work-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Schedule</div>
          <h1>Calendar</h1>
          <p className="lede">
            Meetings and date-based work, clearly distinguished.
          </p>
        </div>
        <button onClick={() => setEditing("new")}>Create meeting</button>
      </div>
      <div className="calendar-toolbar">
        <div className="filter-tabs" role="tablist" aria-label="Calendar views">
          {["month", "week", "day", "agenda"].map((item) => (
            <button
              role="tab"
              aria-selected={view === item}
              className={view === item ? "active" : ""}
              key={item}
              onClick={() => setView(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button
            className="button-secondary"
            aria-label="Previous period"
            onClick={() => move(-1)}
          >
            ←
          </button>
          <button
            className="button-secondary"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </button>
          <button
            className="button-secondary"
            aria-label="Next period"
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
      <h2 className="calendar-heading">{heading}</h2>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="empty-state">Loading calendar…</p>}
      {!loading && view !== "agenda" && (
        <div className={`calendar-grid ${view}`}>
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = events.filter((event) => event.date === key);
            return (
              <section
                className={`calendar-day ${view === "month" && day.getMonth() !== anchor.getMonth() ? "outside" : ""}`}
                key={key}
              >
                <h3>
                  <span>
                    {day.toLocaleDateString(undefined, {
                      weekday: view === "month" ? "short" : "long",
                    })}
                  </span>
                  {day.getDate()}
                </h3>
                {dayEvents.map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    onSelect={(item) => void select(item)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
      {!loading && view === "agenda" && (
        <div className="agenda-list">
          {[...new Set(events.map((event) => event.date))].map((date) => (
            <section key={date}>
              <h3>
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </h3>
              {events
                .filter((event) => event.date === date)
                .map((event) => (
                  <EventButton
                    key={event.id}
                    event={event}
                    onSelect={(item) => void select(item)}
                  />
                ))}
            </section>
          ))}
        </div>
      )}
      {!loading && !events.length && (
        <p className="empty-state">No dated work or meetings yet.</p>
      )}
      {detail && (
        <MeetingDetailPanel
          meeting={detail}
          people={people}
          onChanged={() => void refreshDetail()}
          onEdit={() => setEditing(detail)}
          onDeleted={() => {
            setDetail(null);
            void load();
          }}
        />
      )}
      {editing && (
        <aside className="editor-panel" aria-label="Meeting editor">
          <MeetingForm
            meeting={editing === "new" ? undefined : editing}
            people={people}
            projects={projects}
            onCancel={() => setEditing(null)}
            onSaved={(id) => {
              setEditing(null);
              void load();
              void api<{ meeting: MeetingDetail }>(`/api/meetings/${id}`).then(
                (result) => setDetail(result.meeting),
              );
            }}
          />
        </aside>
      )}
    </div>
  );
}
