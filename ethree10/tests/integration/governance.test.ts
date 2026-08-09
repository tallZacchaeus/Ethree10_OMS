import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, type Project, type User } from "@prisma/client";
import { randomBytes } from "crypto";
import { BudgetService } from "@/server/services/budget";
import { assertSeparationOfDuties } from "@/server/auth/permissions";

/**
 * Money governance.
 *
 * These rules are the most consequential code in the product and previously had
 * no automated coverage inside the test suite — only a standalone script that
 * nobody ran in CI. Every assertion here is a path that MUST fail; if one of
 * them starts passing, the approval chain is worthless.
 */

const db = new PrismaClient();
const tag = randomBytes(4).toString("hex");

let executive: User;
let finance: User;
let branchHead: User;
let member: User;
let admin: User;
let project: Project;

async function makeUser(role: "chief_executive" | "finance_manager" | "branch_head" | "team_member" | "agency_admin") {
  const user = await db.user.create({
    data: { email: `${role}-${tag}@governance.test`, name: `${role} ${tag}` },
  });
  await db.membership.create({
    data: { userId: user.id, role, acceptedAt: new Date() },
  });
  return user;
}

beforeAll(async () => {
  [executive, finance, branchHead, member, admin] = await Promise.all([
    makeUser("chief_executive"),
    makeUser("finance_manager"),
    makeUser("branch_head"),
    makeUser("team_member"),
    makeUser("agency_admin"),
  ]);

  const organization = await db.organization.create({
    data: { name: `Gov Test Client ${tag}`, slug: `gov-test-${tag}`, isExternal: true },
  });
  const request = await db.request.create({
    data: {
      code: `REQ-GOV-${tag}`,
      organizationId: organization.id,
      title: "Governance fixture",
      description: "Fixture request for governance tests.",
      projectType: "",
    },
  });
  project = await db.project.create({
    data: {
      code: `PRJ-GOV-${tag}`,
      requestId: request.id,
      organizationId: organization.id,
      name: "Governance fixture project",
    },
  });
});

afterAll(async () => {
  // Explicit order: Invoice and Receipt do not cascade from Project, so they
  // have to go first or the project delete fails on a foreign key.
  const invoices = await db.invoice.findMany({ where: { projectId: project.id }, select: { id: true } });
  const invoiceIds = invoices.map((invoice) => invoice.id);
  await db.receipt.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await db.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await db.expense.deleteMany({ where: { projectId: project.id } });
  await db.budgetDecision.deleteMany({ where: { budget: { projectId: project.id } } });
  await db.budget.deleteMany({ where: { projectId: project.id } });
  await db.auditLog.deleteMany({ where: { actor: { email: { contains: tag } } } });
  await db.notification.deleteMany({ where: { user: { email: { contains: tag } } } });
  await db.project.deleteMany({ where: { code: `PRJ-GOV-${tag}` } });
  await db.request.deleteMany({ where: { code: `REQ-GOV-${tag}` } });
  await db.organization.deleteMany({ where: { slug: `gov-test-${tag}` } });
  await db.membership.deleteMany({ where: { user: { email: { contains: tag } } } });
  await db.user.deleteMany({ where: { email: { contains: tag } } });
  await db.$disconnect();
});

describe("separation of duties (role assignment)", () => {
  it("refuses to give one person both Chief Executive and Finance Manager", () => {
    expect(() => assertSeparationOfDuties(["chief_executive", "finance_manager"])).toThrow(
      /cannot hold both/i,
    );
  });

  it("allows each of those roles on its own", () => {
    expect(() => assertSeparationOfDuties(["chief_executive"])).not.toThrow();
    expect(() => assertSeparationOfDuties(["finance_manager"])).not.toThrow();
  });

  it("allows delivery roles to be combined", () => {
    expect(() => assertSeparationOfDuties(["branch_head", "department_lead"])).not.toThrow();
  });
});

describe("budget submission", () => {
  it("refuses a team member", async () => {
    await expect(
      BudgetService.submit(member.id, { projectId: project.id, amount: 500_000 }),
    ).rejects.toThrow(/budget.submit/);
  });

  it("refuses the Chief Executive — the approver must not author", async () => {
    await expect(
      BudgetService.submit(executive.id, { projectId: project.id, amount: 500_000 }),
    ).rejects.toThrow(/budget.submit/);
  });

  it("accepts a branch head", async () => {
    const budget = await BudgetService.submit(branchHead.id, {
      projectId: project.id,
      amount: 500_000,
      internalAmount: 200_000,
    });
    expect(budget.status).toBe("submitted");
  });
});

describe("the spending gate", () => {
  it("blocks payment confirmation while the budget is only submitted", async () => {
    const invoice = await db.invoice.create({
      data: {
        code: `INV-GOV-${tag}`,
        organizationId: project.organizationId,
        projectId: project.id,
        currency: "NGN",
        amount: 500_000,
        lineItems: [],
      },
    });
    await expect(
      BudgetService.confirmInvoicePayment(finance.id, {
        invoiceId: invoice.id,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toThrow(/must approve it/i);
  });

  it("blocks a spend request while the budget is only submitted", async () => {
    await expect(
      BudgetService.requestExpense(branchHead.id, {
        projectId: project.id,
        description: "Stock footage",
        amount: 10_000,
      }),
    ).rejects.toThrow(/must approve it/i);
  });
});

describe("budget approval", () => {
  it("refuses Finance", async () => {
    const budget = await db.budget.findUniqueOrThrow({ where: { projectId: project.id } });
    await expect(
      BudgetService.decide(finance.id, { budgetId: budget.id, decision: "approved" }),
    ).rejects.toThrow(/budget.approve/);
  });

  it("refuses the Agency Admin", async () => {
    const budget = await db.budget.findUniqueOrThrow({ where: { projectId: project.id } });
    await expect(
      BudgetService.decide(admin.id, { budgetId: budget.id, decision: "approved" }),
    ).rejects.toThrow(/budget.approve/);
  });

  it("refuses the branch head who submitted it", async () => {
    const budget = await db.budget.findUniqueOrThrow({ where: { projectId: project.id } });
    await expect(
      BudgetService.decide(branchHead.id, { budgetId: budget.id, decision: "approved" }),
    ).rejects.toThrow(/budget.approve/);
  });

  it("accepts the Chief Executive", async () => {
    const budget = await db.budget.findUniqueOrThrow({ where: { projectId: project.id } });
    const decided = await BudgetService.decide(executive.id, {
      budgetId: budget.id,
      decision: "approved",
      note: "Approved for phase 1.",
    });
    expect(decided.status).toBe("approved");
    expect(decided.decidedById).toBe(executive.id);
  });
});

describe("payment confirmation", () => {
  it("refuses the Chief Executive who approved the budget", async () => {
    const invoice = await db.invoice.findFirstOrThrow({ where: { code: `INV-GOV-${tag}` } });
    await expect(
      BudgetService.confirmInvoicePayment(executive.id, {
        invoiceId: invoice.id,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toThrow(/payment.confirm/);
  });

  it("accepts Finance, and issues the receipt", async () => {
    const invoice = await db.invoice.findFirstOrThrow({ where: { code: `INV-GOV-${tag}` } });
    const result = await BudgetService.confirmInvoicePayment(finance.id, {
      invoiceId: invoice.id,
      paymentMethod: "bank_transfer",
      paymentRef: `TXN-${tag}`,
    });
    expect(result.invoice.status).toBe("paid");
    expect(result.receipt.code).toMatch(/^RCPT-/);
  });

  it("refuses a second confirmation of the same payment", async () => {
    const invoice = await db.invoice.findFirstOrThrow({ where: { code: `INV-GOV-${tag}` } });
    await expect(
      BudgetService.confirmInvoicePayment(finance.id, {
        invoiceId: invoice.id,
        paymentMethod: "bank_transfer",
      }),
    ).rejects.toThrow(/already been confirmed/i);
  });
});

describe("outbound spend", () => {
  it("accepts a request inside the approved envelope", async () => {
    const expense = await BudgetService.requestExpense(branchHead.id, {
      projectId: project.id,
      description: "Stock footage licence",
      amount: 50_000,
    });
    expect(expense.status).toBe("requested");
  });

  it("refuses a request that would exceed the approved internal amount", async () => {
    await expect(
      BudgetService.requestExpense(branchHead.id, {
        projectId: project.id,
        description: "Oversized purchase",
        amount: 500_000,
      }),
    ).rejects.toThrow(/over the approved/i);
  });

  it("refuses payment by anyone without expense.pay", async () => {
    const expense = await db.expense.findFirstOrThrow({
      where: { projectId: project.id, status: "requested" },
    });
    await expect(
      BudgetService.payExpense(branchHead.id, { expenseId: expense.id }),
    ).rejects.toThrow(/expense.pay/);
    await expect(
      BudgetService.payExpense(executive.id, { expenseId: expense.id }),
    ).rejects.toThrow(/expense.pay/);
  });

  it("accepts payment by Finance", async () => {
    const expense = await db.expense.findFirstOrThrow({
      where: { projectId: project.id, status: "requested" },
    });
    const paid = await BudgetService.payExpense(finance.id, {
      expenseId: expense.id,
      paymentRef: `EXP-${tag}`,
    });
    expect(paid.status).toBe("paid");
    expect(paid.paidById).toBe(finance.id);
  });
});

describe("revision clears approval", () => {
  it("returns an approved budget to 'submitted' and drops the decision", async () => {
    const before = await db.budget.findUniqueOrThrow({ where: { projectId: project.id } });
    expect(before.status).toBe("approved");

    const revised = await BudgetService.submit(branchHead.id, {
      projectId: project.id,
      amount: 900_000,
      internalAmount: 400_000,
    });

    expect(revised.status).toBe("submitted");
    expect(revised.decidedById).toBeNull();
    expect(revised.version).toBe(before.version + 1);
  });

  it("re-blocks spending until the new amount is approved", async () => {
    await expect(
      BudgetService.requestExpense(branchHead.id, {
        projectId: project.id,
        description: "Spend against an unapproved revision",
        amount: 1_000,
      }),
    ).rejects.toThrow(/must approve it/i);
  });
});
