import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NotificationKind } from "@prisma/client";
import { EMAIL_KINDS } from "@/server/services/notification";

const ROOT = join(__dirname, "../..");

/** Every .ts file under server/, so a kind cannot be declared and never used. */
function serverSources(dir = join(ROOT, "server")): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return serverSources(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

// notification.ts is excluded on purpose: it contains the EMAIL_KINDS list, so
// including it would make every kind look "used" and the check would pass
// trivially. We want the places that actually emit.
const sources = serverSources()
  .filter((f) => !f.endsWith("services/notification.ts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

describe("notification coverage", () => {
  const kinds = Object.values(NotificationKind);

  it("has a kind for every activity area", () => {
    // Guards against the enum being trimmed back without the call sites going
    // with it. These are the areas that had no notifications at all before.
    for (const kind of [
      "invoice_sent",
      "invoice_overdue",
      "payment_received",
      "receipt_issued",
      "expense_requested",
      "expense_paid",
      "budget_decided",
      "member_invited",
      "member_role_changed",
      "member_removed",
      "branch_created",
      "branch_archived",
      "branch_lead_assigned",
      "department_created",
      "department_archived",
      "department_lead_assigned",
      "client_created",
      "client_archived",
      "deliverable_created",
      "deliverable_version_added",
      "contributors_changed",
      "lead_received",
      "lead_converted",
    ]) {
      expect(kinds).toContain(kind);
    }
  });

  it("emails every kind except the two deliberately in-app only", () => {
    // The agreed default is email-on for everything. task_due_soon and
    // request_assigned predate that and stay in-app; anything new must email,
    // or it was added without deciding how it reaches anyone.
    const inAppOnly = new Set(["task_due_soon", "request_assigned"]);
    const missing = kinds.filter((k) => !inAppOnly.has(k) && !EMAIL_KINDS.has(k));
    expect(missing).toEqual([]);
  });

  it("fires every kind from somewhere in server code", () => {
    // A kind nobody emits is a promise the preferences screen cannot keep: it
    // offers a toggle for something that will never arrive.
    const unused = kinds.filter((kind) => !sources.includes(`"${kind}"`));
    expect(unused).toEqual([]);
  });

  it("resolves audiences through the shared helper, not ad-hoc queries", () => {
    // The client-reply bug was a hand-rolled recipient query that missed
    // people. New notification sites should use NotificationAudience so a role
    // added to a group reaches everything it should.
    const audience = readFileSync(
      join(ROOT, "server/services/notification-audience.ts"),
      "utf8",
    );
    for (const helper of ["agencyWide", "executives", "administrators", "finance", "moneyOversight", "projectTeam"]) {
      expect(audience).toContain(`async ${helper}(`);
    }
  });
});
