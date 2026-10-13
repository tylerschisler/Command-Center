import { asc, desc, eq } from "drizzle-orm";
import type { DashboardSnapshot } from "@/domain/command-center";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, briefings, meetingDecisions, meetingParticipants, meetings, people, projects, requests, tasks, type Briefing, type NewActivityEvent, type NewBriefing } from "@/server/db/schema";

export interface CommandCenterRepository {
  snapshot(): DashboardSnapshot;
}

export interface BriefingRepository {
  create(briefing: NewBriefing, event: NewActivityEvent): Briefing;
  findById(id: string): Briefing | undefined;
  list(type?: Briefing["type"]): Briefing[];
}

export class DrizzleCommandCenterRepository implements CommandCenterRepository {
  constructor(private readonly database: AppDatabase) {}
  snapshot(): DashboardSnapshot {
    return {
      tasks: this.database.select().from(tasks).all(),
      projects: this.database.select().from(projects).all(),
      requests: this.database.select().from(requests).all(),
      meetings: this.database.select().from(meetings).all(),
      people: this.database.select().from(people).all(),
      participants: this.database.select({ meetingId: meetingParticipants.meetingId, personId: meetingParticipants.personId }).from(meetingParticipants).all(),
      decisions: this.database.select().from(meetingDecisions).orderBy(asc(meetingDecisions.createdAt)).all(),
      activity: this.database.select().from(activityEvents).orderBy(desc(activityEvents.timestamp)).all(),
    };
  }
}

export class DrizzleBriefingRepository implements BriefingRepository {
  constructor(private readonly database: AppDatabase) {}
  create(briefing: NewBriefing, event: NewActivityEvent): Briefing {
    return this.database.transaction((transaction) => {
      const created = transaction.insert(briefings).values(briefing).returning().get();
      transaction.insert(activityEvents).values(event).run();
      return created;
    });
  }
  findById(id: string) { return this.database.select().from(briefings).where(eq(briefings.id, id)).get(); }
  list(type?: Briefing["type"]) {
    return this.database.select().from(briefings).where(type ? eq(briefings.type, type) : undefined).orderBy(desc(briefings.generatedAt)).all();
  }
}
