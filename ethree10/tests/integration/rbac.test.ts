import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Organization, type Position, type Service, type Team, type User } from '@prisma/client';
import type { Session } from "next-auth";
import { AuthorizationService } from '@/server/services/authorization';
import { can } from '@/server/auth/permissions';
import { scopedDb } from "@/server/db/client";
import { appRouter } from "@/server/trpc/routers/_app";
import { TRPCError } from "@trpc/server";
import { createCallerFactory } from "@/server/trpc/trpc";
import { randomBytes } from "crypto";
import { findOrCreateClientOrg, RequestService } from "@/server/services/request";
import { EmailService } from "@/server/notifications/email";

const db = new PrismaClient();
const createCaller = createCallerFactory(appRouter);

function getCaller(userId: string | null) {
  return createCaller({
    db,
    scopedDb,
    userId,
    session: userId ? ({ user: { id: userId } } as Session) : null,
    headers: new Headers(),
    authorize: async (action: string) => {
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return AuthorizationService.require(userId, action as Parameters<typeof AuthorizationService.require>[1]);
    }
  });
}

function genCode() {
  return randomBytes(4).toString('hex');
}

describe('Phase 1 Verification: RBAC & Link-Only Client Model', () => {
  let orgA: Organization;
  let agencyAdmin: User;
  let teamHead: User;
  let teamMember: User;
  let team1: Team;
  let team2: Team;
  let position: Position;
  let routedService: Service;
  let fallbackService: Service;

  beforeAll(async () => {
    vi.spyOn(EmailService, "sendNotification").mockResolvedValue(true);
    orgA = await db.organization.create({ data: { name: 'Client A', slug: 'client-a-' + Date.now() } });
    team1 = await db.team.create({ data: { name: 'Product Dev', slug: 'pd-' + Date.now() } });
    team2 = await db.team.create({ data: { name: 'Brands', slug: 'brand-' + Date.now() } });
    position = await db.position.create({ data: { name: 'Developer' } });
    routedService = await db.service.create({ data: { name: 'Phase 2 Routed', slug: 'phase-2-routed-' + Date.now(), teamId: team2.id, requiredBriefFields: ['expectedOutcome', 'expectedDeliverables', 'acceptanceCriteria'] } });
    fallbackService = await db.service.create({ data: { name: 'Phase 2 Fallback', slug: 'phase-2-fallback-' + Date.now(), teamId: null, requiredBriefFields: ['expectedOutcome', 'expectedDeliverables', 'acceptanceCriteria'] } });

    const createDbUser = async (email: string) => db.user.create({ data: { email, name: email.split('@')[0]! } });
    agencyAdmin = await createDbUser('admin-' + Date.now() + '@ethree10.com');
    teamHead = await createDbUser('head-' + Date.now() + '@ethree10.com');
    teamMember = await createDbUser('member-' + Date.now() + '@ethree10.com');

    await db.membership.create({ data: { userId: agencyAdmin.id, role: 'agency_admin', acceptedAt: new Date() } });
    await db.membership.create({ data: { userId: teamHead.id, role: 'team_head', teamId: team1.id, acceptedAt: new Date() } });
    await db.membership.create({ data: { userId: teamMember.id, role: 'team_member', teamId: team1.id, positionId: position.id, acceptedAt: new Date() } });
  });

  afterAll(async () => {
    try {
      if (agencyAdmin?.id) await db.membership.deleteMany({ where: { userId: { in: [agencyAdmin.id, teamHead.id, teamMember.id] } } });
      if (agencyAdmin?.id) await db.user.deleteMany({ where: { id: { in: [agencyAdmin.id, teamHead.id, teamMember.id] } } });
      if (position?.id) await db.position.deleteMany({ where: { id: position.id } });
      if (routedService?.id) await db.service.deleteMany({ where: { id: { in: [routedService.id, fallbackService.id] } } });
      if (team1?.id) await db.team.deleteMany({ where: { id: { in: [team1.id, team2.id] } } });
      if (orgA?.id) await db.organization.deleteMany({ where: { id: orgA.id } });
    } catch(e) {}
    await db.$disconnect();
  });

  it('agency admins receive permitted agency-wide access', async () => {
    const ctx = await AuthorizationService.resolve(agencyAdmin.id);
    expect(can(ctx, 'team.read')).toBe(true);
    expect(can(ctx, 'team.create')).toBe(true);
  });

  it('team heads can manage only their assigned teams', async () => {
    const ctx = await AuthorizationService.resolve(teamHead.id);
    expect(ctx.teamId).toBe(team1.id);
    expect(can(ctx, 'team.read')).toBe(true);
    expect(can(ctx, 'team.create')).toBe(false);
  });

  it('team members cannot perform team-head actions', async () => {
    const ctx = await AuthorizationService.resolve(teamMember.id);
    expect(ctx.teamId).toBe(team1.id);
    expect(can(ctx, 'team.read')).toBe(true);
    expect(can(ctx, 'team.create')).toBe(false);
  });

  it('team head cannot update another team', async () => {
    const caller = getCaller(teamHead.id);
    await expect(caller.teams.update({ id: team2.id, name: 'Hacked Team' })).rejects.toThrow(/Cannot update a team you do not head/);
  });

  it('team head can update their own team', async () => {
    const caller = getCaller(teamHead.id);
    const updated = await caller.teams.update({ id: team1.id, name: 'Product Dev (Updated)' });
    expect(updated.name).toBe('Product Dev (Updated)');
  });

  it('unauthenticated requests correctly enforce authorization limits on api', async () => {
    const unauthCaller = getCaller(null);
    await expect(unauthCaller.requests.list({ organizationId: orgA.id })).rejects.toThrow(/You must be signed in/);
  });

  it('ensures staff can access requests across organizations due to agency status', async () => {
    const reqCode = genCode();
    const req = await db.request.create({
      data: {
        code: reqCode,
        title: "Test Request",
        description: "Testing access",
        projectType: "Dev",
        organizationId: orgA.id,
      }
    });

    const adminCaller = getCaller(agencyAdmin.id);
    const requests = await adminCaller.requests.list({ organizationId: orgA.id });
    expect(requests.length).toBeGreaterThanOrEqual(1);

    await db.request.delete({ where: { id: req.id } });
  });

  it('prevents cross-team project reads (IDOR)', async () => {
    // Team 2 creates a project
    const req = await db.request.create({
      data: { code: genCode(), title: "R1", description: "D1", projectType: "Dev", organizationId: orgA.id }
    });
    const p = await db.project.create({
      data: {
        code: genCode(),
        name: "Team 2 Secret",
        organizationId: orgA.id,
        agencyTeamId: team2.id,
        requestId: req.id,
        status: "active"
      }
    });

    // Team 1 member tries to read it
    const memberCaller = getCaller(teamMember.id);
    await expect(memberCaller.projects.get({ id: p.id })).rejects.toThrow(/FORBIDDEN/);

    await db.project.delete({ where: { id: p.id } });
    await db.request.delete({ where: { id: req.id } });
  });

  it('prevents cross-team project mutations', async () => {
    const req = await db.request.create({
      data: { code: genCode(), title: "R2", description: "D2", projectType: "Dev", organizationId: orgA.id }
    });
    const p = await db.project.create({
      data: {
        code: genCode(),
        name: "Team 2 Secret",
        organizationId: orgA.id,
        agencyTeamId: team2.id,
        requestId: req.id,
        status: "active"
      }
    });

    const headCaller = getCaller(teamHead.id); // Head of Team 1
    await expect(headCaller.projects.update({ id: p.id, name: "Hacked" })).rejects.toThrow(/FORBIDDEN/);

    await db.project.delete({ where: { id: p.id } });
    await db.request.delete({ where: { id: req.id } });
  });

  it('routes a request to the team configured on its service', async () => {
    const request = await RequestService.create({ actorId: agencyAdmin.id, organizationId: orgA.id, input: { title: 'Service-routed request', description: 'A complete request description', projectType: routedService.slug, serviceId: routedService.id, urgency: 'medium', expectedOutcome: 'A measurable business outcome', expectedDeliverables: 'A reviewed final deliverable', acceptanceCriteria: 'The agreed checks pass' } });
    expect(request.routedTeamId).toBe(team2.id);
    await db.requestStageEvent.deleteMany({ where: { requestId: request.id } });
    await db.request.delete({ where: { id: request.id } });
  });

  it('sends a fallback service request to agency-level intake', async () => {
    const request = await RequestService.create({ actorId: agencyAdmin.id, organizationId: orgA.id, input: { title: 'Cross-team request', description: 'A complete cross-team description', projectType: fallbackService.slug, serviceId: fallbackService.id, urgency: 'medium', expectedOutcome: 'A coordinated agency outcome', expectedDeliverables: 'A cross-team delivery plan', acceptanceCriteria: 'Both teams approve the result' } });
    expect(request.routedTeamId).toBeNull();
    await db.requestStageEvent.deleteMany({ where: { requestId: request.id } });
    await db.request.delete({ where: { id: request.id } });
  });

  it('rejects incomplete service briefs on the server', async () => {
    await expect(RequestService.create({ actorId: agencyAdmin.id, organizationId: orgA.id, input: { title: 'Incomplete brief', description: 'This brief is incomplete', projectType: routedService.slug, serviceId: routedService.id, urgency: 'medium' } })).rejects.toThrow(/Missing required brief fields/);
  });

  it('allows only the owning team head or agency admin to accept routed work', async () => {
    const request = await db.request.create({ data: { code: genCode(), title: 'Team 2 intake', description: 'Team 2 only', projectType: routedService.slug, serviceId: routedService.id, organizationId: orgA.id, routedTeamId: team2.id } });
    await expect(getCaller(teamHead.id).requests.approve({ id: request.id })).rejects.toThrow(/FORBIDDEN/);
    await db.request.delete({ where: { id: request.id } });
  });

  it('does not merge same-name organizations across unrelated email domains', async () => {
    const suffix = Date.now().toString();
    const first = await findOrCreateClientOrg({ name: `Shared Name ${suffix}`, requesterEmail: `one@alpha-${suffix}.example` });
    const request = await db.request.create({ data: { code: genCode(), title: 'Dedupe evidence', description: 'Existing domain evidence', projectType: 'test', organizationId: first.id, requesterEmail: `one@alpha-${suffix}.example` } });
    const sameDomain = await findOrCreateClientOrg({ name: `Shared Name ${suffix}`, requesterEmail: `two@alpha-${suffix}.example` });
    const otherDomain = await findOrCreateClientOrg({ name: `Shared Name ${suffix}`, requesterEmail: `one@beta-${suffix}.example` });
    expect(sameDomain.id).toBe(first.id);
    expect(otherDomain.id).not.toBe(first.id);
    await db.request.delete({ where: { id: request.id } });
    await db.organization.deleteMany({ where: { id: { in: [first.id, otherDomain.id] } } });
  });
});
