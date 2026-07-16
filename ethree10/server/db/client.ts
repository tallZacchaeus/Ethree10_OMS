import { PrismaClient, Prisma } from "@prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * Returns a scoped API that automatically injects `workspaceId` into
 * every read operation for workspace-owned models.
 *
 * Client (org-scoped) procedures use this so a client can only ever touch their own
 * organization's data. Staff operate globally via raw `db`.
 */
export function scopedDb(organizationId: string) {
  const ws = { organizationId };
  return {
    /** Pass-through for models that need full access within the organization. */
    raw: db,
    organizationId,

    request: {
      findMany: (args: Omit<Prisma.RequestFindManyArgs, "where"> & { where?: Prisma.RequestWhereInput } = {}) =>
        db.request.findMany({ ...args, where: { ...args.where, ...ws } }),
      findFirst: (args: Omit<Prisma.RequestFindFirstArgs, "where"> & { where?: Prisma.RequestWhereInput } = {}) =>
        db.request.findFirst({ ...args, where: { ...args.where, ...ws } }),
      findUnique: db.request.findUnique.bind(db.request),
      create: db.request.create.bind(db.request),
      update: db.request.update.bind(db.request),
      delete: db.request.delete.bind(db.request),
      count: (args: Omit<Prisma.RequestCountArgs, "where"> & { where?: Prisma.RequestWhereInput } = {}) =>
        db.request.count({ ...args, where: { ...args.where, ...ws } }),
    },

    project: {
      findMany: (args: Omit<Prisma.ProjectFindManyArgs, "where"> & { where?: Prisma.ProjectWhereInput } = {}) =>
        db.project.findMany({ ...args, where: { ...args.where, ...ws } }),
      findFirst: (args: Omit<Prisma.ProjectFindFirstArgs, "where"> & { where?: Prisma.ProjectWhereInput } = {}) =>
        db.project.findFirst({ ...args, where: { ...args.where, ...ws } }),
      findUnique: db.project.findUnique.bind(db.project),
      create: db.project.create.bind(db.project),
      update: db.project.update.bind(db.project),
      delete: db.project.delete.bind(db.project),
      count: (args: Omit<Prisma.ProjectCountArgs, "where"> & { where?: Prisma.ProjectWhereInput } = {}) =>
        db.project.count({ ...args, where: { ...args.where, ...ws } }),
    },

    membership: {
      findMany: (args: Omit<Prisma.MembershipFindManyArgs, "where"> & { where?: Prisma.MembershipWhereInput } = {}) =>
        db.membership.findMany({ ...args, where: { ...args.where, ...ws } }),
      findFirst: (args: Omit<Prisma.MembershipFindFirstArgs, "where"> & { where?: Prisma.MembershipWhereInput } = {}) =>
        db.membership.findFirst({ ...args, where: { ...args.where, ...ws } }),
      findUnique: db.membership.findUnique.bind(db.membership),
      create: db.membership.create.bind(db.membership),
      update: db.membership.update.bind(db.membership),
    },
  };
}
