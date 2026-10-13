import { and, asc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, meetingDecisions, meetingParticipants, meetings, type Meeting, type MeetingDecision, type NewActivityEvent, type NewMeeting, type NewMeetingDecision } from "@/server/db/schema";

export interface MeetingListFilters {
  projectId?: string;
  personId?: string;
  status?: Meeting["status"];
  archived?: boolean;
}

export interface MeetingRepository {
  create(meeting: NewMeeting, event: NewActivityEvent, participantIds?: string[], participantEvents?: NewActivityEvent[]): Meeting;
  findById(id: string): Meeting | undefined;
  list(filters?: MeetingListFilters): Meeting[];
  update(id: string, changes: Partial<NewMeeting>, event: NewActivityEvent): Meeting | undefined;
  listParticipantIds(meetingId: string): string[];
  addParticipant(meetingId: string, personId: string, createdAt: string, event: NewActivityEvent): boolean;
  removeParticipant(meetingId: string, personId: string, event: NewActivityEvent): boolean;
  listDecisions(meetingId: string): MeetingDecision[];
  addDecision(decision: NewMeetingDecision, event: NewActivityEvent): MeetingDecision;
}

export class DrizzleMeetingRepository implements MeetingRepository {
  constructor(private readonly database: AppDatabase) {}
  create(meeting: NewMeeting, event: NewActivityEvent, participantIds: string[] = [], participantEvents: NewActivityEvent[] = []) {
    return this.database.transaction((tx) => {
      const created = tx.insert(meetings).values(meeting).returning().get();
      if (participantIds.length) tx.insert(meetingParticipants).values(participantIds.map((personId) => ({ meetingId: meeting.id, personId, createdAt: meeting.createdAt }))).run();
      tx.insert(activityEvents).values([event, ...participantEvents]).run();
      return created;
    });
  }
  findById(id: string) { return this.database.select().from(meetings).where(eq(meetings.id, id)).get(); }
  list(filters: MeetingListFilters = {}) {
    const conditions: SQL[] = [filters.archived ? isNotNull(meetings.archivedAt) : isNull(meetings.archivedAt)];
    if (filters.projectId) conditions.push(eq(meetings.projectId, filters.projectId));
    if (filters.status) conditions.push(eq(meetings.status, filters.status));
    if (filters.personId) {
      return this.database.select({ meeting: meetings }).from(meetings).innerJoin(meetingParticipants, eq(meetings.id, meetingParticipants.meetingId))
        .where(and(...conditions, eq(meetingParticipants.personId, filters.personId))).orderBy(asc(meetings.startDateTime)).all().map((row) => row.meeting);
    }
    return this.database.select().from(meetings).where(and(...conditions)).orderBy(asc(meetings.startDateTime)).all();
  }
  update(id: string, changes: Partial<NewMeeting>, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const updated = tx.update(meetings).set(changes).where(eq(meetings.id, id)).returning().get();
      if (!updated) return undefined;
      tx.insert(activityEvents).values(event).run(); return updated;
    });
  }
  listParticipantIds(meetingId: string) { return this.database.select({ personId: meetingParticipants.personId }).from(meetingParticipants).where(eq(meetingParticipants.meetingId, meetingId)).all().map((row) => row.personId); }
  addParticipant(meetingId: string, personId: string, createdAt: string, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const exists = tx.select().from(meetingParticipants).where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.personId, personId))).get();
      if (exists) return false;
      tx.insert(meetingParticipants).values({ meetingId, personId, createdAt }).run(); tx.insert(activityEvents).values(event).run(); return true;
    });
  }
  removeParticipant(meetingId: string, personId: string, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      const removed = tx.delete(meetingParticipants).where(and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.personId, personId))).returning().get();
      if (!removed) return false;
      tx.insert(activityEvents).values(event).run(); return true;
    });
  }
  listDecisions(meetingId: string) { return this.database.select().from(meetingDecisions).where(eq(meetingDecisions.meetingId, meetingId)).orderBy(asc(meetingDecisions.createdAt)).all(); }
  addDecision(decision: NewMeetingDecision, event: NewActivityEvent) {
    return this.database.transaction((tx) => { const created = tx.insert(meetingDecisions).values(decision).returning().get(); tx.insert(activityEvents).values(event).run(); return created; });
  }
}
