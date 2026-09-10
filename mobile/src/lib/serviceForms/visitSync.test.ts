import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

/**
 * Mirrors deleteVisit + syncServiceFormVisit: keep the checklist, and
 * update the linked visit when it still exists, otherwise log a new one.
 */
function syncVisit(
  db: DatabaseSync,
  formId: string,
  farmId: string,
  formDate: string,
  notes: string,
) {
  const existing = db
    .prepare("SELECT visit_id FROM service_forms WHERE id = ? AND farm_id = ?")
    .get(formId, farmId) as { visit_id: string | null } | undefined;
  if (!existing) throw new Error("Service form not found");

  let visitId = existing.visit_id;
  if (visitId) {
    const visit = db
      .prepare("SELECT id FROM farm_visits WHERE id = ? AND farm_id = ?")
      .get(visitId, farmId) as { id: string } | undefined;
    if (visit) {
      db.prepare("UPDATE farm_visits SET visit_date = ?, notes = ? WHERE id = ? AND farm_id = ?").run(
        formDate,
        notes,
        visitId,
        farmId,
      );
      return { action: "update" as const, visitId };
    }
    visitId = null;
  }

  const newId = `visit_${formDate}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    "INSERT INTO farm_visits (id, farm_id, visit_date, visit_type, notes) VALUES (?, ?, ?, 'ROUTINE_SERVICE', ?)",
  ).run(newId, farmId, formDate, notes);
  db.prepare("UPDATE service_forms SET visit_id = ? WHERE id = ? AND farm_id = ?").run(
    newId,
    formId,
    farmId,
  );
  return { action: "create" as const, visitId: newId };
}

function deleteVisitKeepForm(db: DatabaseSync, farmId: string, visitId: string) {
  db.prepare("UPDATE service_forms SET visit_id = NULL WHERE visit_id = ? AND farm_id = ?").run(
    visitId,
    farmId,
  );
  db.prepare("DELETE FROM farm_visits WHERE id = ? AND farm_id = ?").run(visitId, farmId);
}

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE farm_visits (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      visit_type TEXT NOT NULL DEFAULT 'ROUTINE_SERVICE',
      notes TEXT
    );
    CREATE TABLE service_forms (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      form_date TEXT NOT NULL,
      visit_id TEXT
    );
  `);
  db.prepare("INSERT INTO farm_visits (id, farm_id, visit_date, notes) VALUES (?, ?, ?, ?)").run(
    "visit_1",
    "farm_1",
    "2026-08-01",
    "Routine Service",
  );
  db.prepare("INSERT INTO service_forms (id, farm_id, form_date, visit_id) VALUES (?, ?, ?, ?)").run(
    "form_1",
    "farm_1",
    "2026-08-01",
    "visit_1",
  );
  return db;
}

function visitNotesFromChecklist(visitNotes?: string | null) {
  const notes = visitNotes?.trim() || "";
  return notes || null;
}

describe("checklist visit notes", () => {
  it("keeps only the checklist comments", () => {
    assert.equal(visitNotesFromChecklist("House 2 fans noisy"), "House 2 fans noisy");
    assert.equal(visitNotesFromChecklist("  "), null);
    assert.equal(visitNotesFromChecklist(null), null);
  });
});

describe("checklist visit sync", () => {
  it("updates the same visit when it is still linked", () => {
    const db = setup();
    const result = syncVisit(db, "form_1", "farm_1", "2026-08-10", "Updated notes");
    assert.equal(result.action, "update");
    assert.equal(result.visitId, "visit_1");

    const visits = db.prepare("SELECT id, visit_date, notes FROM farm_visits").all() as Array<{
      id: string;
      visit_date: string;
      notes: string;
    }>;
    assert.equal(visits.length, 1);
    assert.equal(visits[0]?.id, "visit_1");
    assert.equal(visits[0]?.visit_date, "2026-08-10");
    assert.equal(visits[0]?.notes, "Updated notes");

    const form = db.prepare("SELECT visit_id FROM service_forms WHERE id = ?").get("form_1") as {
      visit_id: string;
    };
    assert.equal(form.visit_id, "visit_1");
    db.close();
  });

  it("logs a new visit after the linked visit is deleted", () => {
    const db = setup();
    deleteVisitKeepForm(db, "farm_1", "visit_1");

    const formAfterDelete = db
      .prepare("SELECT visit_id FROM service_forms WHERE id = ?")
      .get("form_1") as { visit_id: string | null };
    assert.equal(formAfterDelete.visit_id, null);
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS c FROM farm_visits").get() as { c: number }).c,
      0,
    );

    const result = syncVisit(db, "form_1", "farm_1", "2026-08-11", "Routine Service");
    assert.equal(result.action, "create");
    assert.notEqual(result.visitId, "visit_1");

    const visits = db.prepare("SELECT id, visit_date FROM farm_visits").all() as Array<{
      id: string;
      visit_date: string;
    }>;
    assert.equal(visits.length, 1);
    assert.equal(visits[0]?.id, result.visitId);
    assert.equal(visits[0]?.visit_date, "2026-08-11");

    const form = db.prepare("SELECT visit_id FROM service_forms WHERE id = ?").get("form_1") as {
      visit_id: string;
    };
    assert.equal(form.visit_id, result.visitId);
    db.close();
  });

  it("logs a new visit when the form still points at a missing visit row", () => {
    const db = setup();
    db.prepare("DELETE FROM farm_visits WHERE id = ?").run("visit_1");

    const result = syncVisit(db, "form_1", "farm_1", "2026-08-12", "Routine Service");
    assert.equal(result.action, "create");
    const form = db.prepare("SELECT visit_id FROM service_forms WHERE id = ?").get("form_1") as {
      visit_id: string;
    };
    assert.equal(form.visit_id, result.visitId);
    db.close();
  });

  it("still finds the checklist by form id after the visit is deleted", () => {
    const db = setup();
    deleteVisitKeepForm(db, "farm_1", "visit_1");

    const byForm = db
      .prepare("SELECT id FROM service_forms WHERE id = ? AND farm_id = ?")
      .get("form_1", "farm_1") as { id: string } | undefined;
    const byVisit = db
      .prepare("SELECT id FROM service_forms WHERE visit_id = ? AND farm_id = ?")
      .get("visit_1", "farm_1") as { id: string } | undefined;

    assert.equal(byForm?.id, "form_1");
    assert.equal(byVisit, undefined);
    db.close();
  });
});
