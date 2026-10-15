import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { AppDatabase } from "@/server/db/client";
import { activityEvents, entityRelationships, people, type NewActivityEvent, type NewPerson, type Person } from "@/server/db/schema";

export interface PersonRepository {
  create(person: NewPerson, event: NewActivityEvent): Person;
  findById(id: string): Person | undefined;
  list(archived?: boolean): Person[];
  update(id: string, changes: Partial<NewPerson>, event: NewActivityEvent): Person | undefined;
  delete(id: string, event: NewActivityEvent): boolean;
}

export class DrizzlePersonRepository implements PersonRepository {
  constructor(private readonly database: AppDatabase) {}
  create(person: NewPerson, event: NewActivityEvent): Person {
    return this.database.transaction((tx) => {
      const created = tx.insert(people).values(person).returning().get();
      tx.insert(activityEvents).values(event).run();
      return created;
    });
  }
  findById(id: string) { return this.database.select().from(people).where(eq(people.id, id)).get(); }
  list(archived = false) {
    return this.database.select().from(people)
      .where(and(archived ? isNotNull(people.archivedAt) : isNull(people.archivedAt)))
      .orderBy(asc(people.displayName)).all();
  }
  update(id: string, changes: Partial<NewPerson>, event: NewActivityEvent): Person | undefined {
    return this.database.transaction((tx) => {
      const updated = tx.update(people).set(changes).where(eq(people.id, id)).returning().get();
      if (!updated) return undefined;
      tx.insert(activityEvents).values(event).run();
      return updated;
    });
  }
  delete(id: string, event: NewActivityEvent) {
    return this.database.transaction((tx) => {
      tx.delete(entityRelationships).where(and(eq(entityRelationships.targetType, "person"), eq(entityRelationships.targetId, id))).run();
      const removed = tx.delete(people).where(eq(people.id, id)).returning({ id: people.id }).get();
      if (!removed) return false;
      tx.insert(activityEvents).values(event).run();
      return true;
    });
  }
}
