/**
 * Governance verification.
 *
 * Exercises the money rules end-to-end against the live dev database, as each
 * real role, and asserts that every path which should be blocked *is* blocked.
 *
 * Requires a freshly seeded database — it submits and approves a real budget, so
 * running it twice in a row leaves the seed project's budget already revised and
 * some assertions will not hold. Reset first:
 *
 *   pnpm exec prisma db push --force-reset --accept-data-loss && pnpm db:seed
 *   pnpm tsx scripts/verify-governance.ts
 */
import { PrismaClient } from "@prisma/client";
import { BudgetService } from "../server/services/budget";
import { DelegationService } from "../server/services/delegation";
import { assertSeparationOfDuties, can } from "../server/auth/permissions";
import { getAgencyAuthContext } from "../server/services/agency";

const db = new PrismaClient();

let passed = 0;
let failed = 0;

function ok(label: string) {
  passed += 1;
  console.log(`  [32m✓[0m ${label}`);
}
function bad(label: string, detail: string) {
  failed += 1;
  console.log(`  [31m✗[0m ${label}\n      ${detail}`);
}

/** Assert that `fn` throws, and that the message explains why. */
async function mustFail(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    bad(label, "Expected this to be blocked, but it succeeded.");
  } catch (error) {
    ok(`${label} — blocked: "${(error as Error).message.slice(0, 90)}"`);
  }
}

async function mustPass(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label);
  } catch (error) {
    bad(label, (error as Error).message);
  }
}

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const byEmail = async (email: string) => {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error(`Seed user missing: ${email}`);
    return user;
  };

  const exec = await byEmail("executive@ethree10.r4c.global");
  const finance = await byEmail("finance@ethree10.r4c.global");
  const techLead = await byEmail("techlead@ethree10.r4c.global");
  const member = await byEmail("member@ethree10.r4c.global");
  const admin = await byEmail("admin.ops@ethree10.r4c.global");
  const coo = await byEmail("operations@ethree10.r4c.global");

  const project = await db.project.findFirst();
  if (!project) throw new Error("Seed project missing.");

  console.log("\n── Separation of duties (role assignment) ──────────────────");
  await mustFail("One person holding Chief Executive + Finance Manager", async () =>
    assertSeparationOfDuties(["chief_executive", "finance_manager"]),
  );
  await mustPass("Chief Executive alone is allowed", async () =>
    assertSeparationOfDuties(["chief_executive"]),
  );
  await mustPass("Branch head + department lead is allowed", async () =>
    assertSeparationOfDuties(["branch_head", "department_lead"]),
  );

  console.log("\n── Budget submission ──────────────────────────────────────");
  await mustFail("Team member submitting a budget", async () =>
    BudgetService.submit(member.id, { projectId: project.id, amount: 500000 }),
  );
  await mustFail("Chief Executive submitting a budget (approver must not author)", async () =>
    BudgetService.submit(exec.id, { projectId: project.id, amount: 500000 }),
  );
  await mustPass("Branch head submitting a budget", async () =>
    BudgetService.submit(techLead.id, {
      projectId: project.id,
      amount: 500000,
      internalAmount: 200000,
      notes: "Build + design for the booking platform.",
    }),
  );

  const budget = await db.budget.findUnique({ where: { projectId: project.id } });
  if (!budget) throw new Error("Budget was not created.");

  console.log("\n── Spending gate (before approval) ────────────────────────");
  const invoice = await db.invoice.create({
    data: {
      code: `INV-VERIFY-${Date.now().toString(36).toUpperCase()}`,
      organizationId: project.organizationId,
      projectId: project.id,
      currency: "NGN",
      amount: 500000,
      lineItems: [{ description: "Phase 1", quantity: 1, unitPrice: 500000 }],
      status: "draft",
    },
  });
  await mustFail("Confirming payment while budget is only 'submitted'", async () =>
    BudgetService.confirmInvoicePayment(finance.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
    }),
  );
  await mustFail("Requesting spend while budget is only 'submitted'", async () =>
    BudgetService.requestExpense(techLead.id, {
      projectId: project.id,
      description: "Stock footage licence",
      amount: 50000,
    }),
  );

  console.log("\n── Budget approval ────────────────────────────────────────");
  await mustFail("Finance approving a budget", async () =>
    BudgetService.decide(finance.id, { budgetId: budget.id, decision: "approved" }),
  );
  await mustFail("Branch head approving their own budget", async () =>
    BudgetService.decide(techLead.id, { budgetId: budget.id, decision: "approved" }),
  );
  await mustFail("Agency admin approving a budget", async () =>
    BudgetService.decide(admin.id, { budgetId: budget.id, decision: "approved" }),
  );
  await mustPass("Chief Executive approving the budget", async () =>
    BudgetService.decide(exec.id, {
      budgetId: budget.id,
      decision: "approved",
      note: "Approved for phase 1.",
    }),
  );

  console.log("\n── Payment confirmation (after approval) ──────────────────");
  await mustFail("Chief Executive confirming payment on a budget they approved", async () =>
    BudgetService.confirmInvoicePayment(exec.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
    }),
  );
  await mustFail("Branch head confirming payment", async () =>
    BudgetService.confirmInvoicePayment(techLead.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
    }),
  );
  await mustPass("Finance confirming payment (issues receipt)", async () =>
    BudgetService.confirmInvoicePayment(finance.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
      paymentRef: "VERIFY-TXN-001",
    }),
  );
  await mustFail("Confirming the same payment twice", async () =>
    BudgetService.confirmInvoicePayment(finance.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
    }),
  );

  const receipt = await db.receipt.findUnique({ where: { invoiceId: invoice.id } });
  if (receipt) ok(`Receipt auto-issued on confirmation: ${receipt.code}`);
  else bad("Receipt auto-issued on confirmation", "No receipt row found.");

  console.log("\n── Outbound spend ─────────────────────────────────────────");
  await mustPass("Branch head requesting spend against approved budget", async () =>
    BudgetService.requestExpense(techLead.id, {
      projectId: project.id,
      description: "Stock footage licence",
      amount: 50000,
    }),
  );
  await mustFail("Spend that would exceed the approved internal ceiling", async () =>
    BudgetService.requestExpense(techLead.id, {
      projectId: project.id,
      description: "Oversized purchase",
      amount: 500000,
    }),
  );

  const expense = await db.expense.findFirst({
    where: { projectId: project.id, status: "requested" },
    orderBy: { createdAt: "desc" },
  });
  if (expense) {
    await mustFail("Requester paying their own expense", async () =>
      BudgetService.payExpense(techLead.id, { expenseId: expense.id }),
    );
    await mustFail("Chief Executive paying an expense", async () =>
      BudgetService.payExpense(exec.id, { expenseId: expense.id }),
    );
    await mustPass("Finance paying the expense", async () =>
      BudgetService.payExpense(finance.id, { expenseId: expense.id, paymentRef: "VERIFY-EXP-001" }),
    );
  }

  console.log("\n── Re-submission clears prior approval ────────────────────");
  await mustPass("Branch head revising the approved budget", async () =>
    BudgetService.submit(techLead.id, { projectId: project.id, amount: 900000, internalAmount: 400000 }),
  );
  const revised = await db.budget.findUnique({ where: { projectId: project.id } });
  if (revised?.status === "submitted" && revised.decidedById === null) {
    ok(`Revision reset to 'submitted' and cleared the approval (v${revised.version})`);
  } else {
    bad("Revision resets approval", `status=${revised?.status} decidedById=${revised?.decidedById}`);
  }

  console.log("\n── Chief Operating Officer ────────────────────────────────");
  const cooCtx = await getAgencyAuthContext(coo.id);
  if (!can(cooCtx, "budget.approve")) {
    ok("COO cannot approve a budget by role");
  } else {
    bad("COO cannot approve by role", "COO holds budget.approve without a delegation");
  }
  const adminCtx = await getAgencyAuthContext(admin.id);
  const cooOnly = ["team.create", "organization.archive", "project.delete", "integration.manage"] as const;
  for (const action of cooOnly) {
    if (can(cooCtx, action) && !can(adminCtx, action)) {
      ok(`${action} is COO-only`);
    } else {
      bad(`${action} is COO-only`, `coo=${can(cooCtx, action)} admin=${can(adminCtx, action)}`);
    }
  }

  console.log("\n── Budget approval delegation ─────────────────────────────");
  await mustFail("COO granting itself a delegation", async () =>
    DelegationService.grant({
      actorId: coo.id,
      delegateId: admin.id,
      reason: "should be refused",
      expiresAt: new Date(Date.now() + DAY),
    }),
  );
  await mustFail("Chief Executive delegating to themselves", async () =>
    DelegationService.grant({
      actorId: exec.id,
      delegateId: exec.id,
      reason: "should be refused",
      expiresAt: new Date(Date.now() + DAY),
    }),
  );
  await mustFail("A delegation longer than the 90-day cap", async () =>
    DelegationService.grant({
      actorId: exec.id,
      delegateId: coo.id,
      reason: "should be refused",
      expiresAt: new Date(Date.now() + 120 * DAY),
    }),
  );
  await mustFail("Delegating to someone who can confirm payments", async () =>
    DelegationService.grant({
      actorId: exec.id,
      delegateId: finance.id,
      reason: "should be refused — separation of duties",
      expiresAt: new Date(Date.now() + DAY),
    }),
  );

  const delegation = await DelegationService.grant({
    actorId: exec.id,
    delegateId: coo.id,
    reason: "verify-governance run",
    expiresAt: new Date(Date.now() + 7 * DAY),
  });
  const delegatedCtx = await getAgencyAuthContext(coo.id);
  if (can(delegatedCtx, "budget.approve")) {
    ok("COO can approve while a delegation is active");
  } else {
    bad("COO can approve while delegated", "budget.approve still denied");
  }
  if (!can(delegatedCtx, "payment.confirm") && !can(delegatedCtx, "expense.pay")) {
    ok("A delegated approver still cannot move money");
  } else {
    bad("Delegated approver cannot move money", "delegation leaked payment rights");
  }

  await DelegationService.revoke({ actorId: exec.id, delegationId: delegation.id });
  const revokedCtx = await getAgencyAuthContext(coo.id);
  if (!can(revokedCtx, "budget.approve")) {
    ok("Revoking a delegation removes approval immediately");
  } else {
    bad("Revoke removes approval", "budget.approve survived revocation");
  }

  const delegationAudit = await db.auditLog.count({
    where: { entityType: "BudgetApprovalDelegation", entityId: delegation.id },
  });
  if (delegationAudit >= 2) {
    ok(`Grant and revoke are both audited (${delegationAudit} entries)`);
  } else {
    bad("Delegation is audited", `${delegationAudit} audit entries found`);
  }

  await db.auditLog.deleteMany({ where: { entityId: delegation.id } });
  await db.notification.deleteMany({ where: { entityId: delegation.id } });
  await db.budgetApprovalDelegation.delete({ where: { id: delegation.id } });

  console.log(`\n${failed === 0 ? "[32m" : "[31m"}${passed} passed, ${failed} failed[0m\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
