import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { generateCode, parseCode } from "@/lib/utils/codes";
import { allocateWithCode } from "@/server/services/code-allocator";

export interface TemplateTaskDef {
  title: string;
  description?: string;
  subUnitId?: string;
  estimatedHours?: number;
  dependenciesByIndex?: number[];
}


/**
 * Highest task code in use this year, plus one. Mirrors the helper in
 * task.ts — both must agree, because they allocate from the same space.
 */
async function nextTaskSeq(): Promise<number> {
  const year = new Date().getUTCFullYear();
  const latest = await db.task.findFirst({
    where: { code: { startsWith: `TSK-${year}-` } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return (latest ? parseCode(latest.code)?.seq ?? 0 : 0) + 1;
}

export class TemplateService {
  static async list() {
    return db.projectTemplate.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(args: {
    actorId: string;
    name: string;
    description?: string;
    projectType: string;
    tasks: TemplateTaskDef[];
  }) {
    const template = await db.projectTemplate.create({
      data: {
        name: args.name,
        description: args.description,
        projectType: args.projectType,
        tasks: args.tasks as unknown as Prisma.InputJsonValue,
        createdById: args.actorId,
      },
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "template.create",
      entityType: "ProjectTemplate",
      entityId: template.id,
      after: { name: template.name, tasksCount: args.tasks.length },
    });

    return template;
  }

  static async applyToProject(args: { actorId: string; templateId: string; projectId: string }) {
    const template = await db.projectTemplate.findUnique({ where: { id: args.templateId } });
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

    const project = await db.project.findUnique({ where: { id: args.projectId } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

    const taskDefs = template.tasks as Prisma.JsonArray as unknown as TemplateTaskDef[];
    
    // Create tasks first so we have their actual IDs
    const createdTasks = [];

    for (let i = 0; i < taskDefs.length; i++) {
      const def = taskDefs[i];
      if (!def) continue;

      // Task codes are agency-wide for the year. This used to number them from
      // a count of tasks *in this project*, so applying a template to the second
      // project of any year asked for TSK-<year>-00001 — a code that already
      // existed — and the unique constraint turned a valid action into a 500.
      // allocateWithCode reads the real sequence and retries on collision, so
      // applying several templates at once no longer races either.
      const created = await allocateWithCode({
        nextSeq: nextTaskSeq,
        format: (seq) => generateCode("task", seq),
        create: (code) =>
          db.task.create({
            data: {
              code,
              projectId: args.projectId,
              title: def.title,
              description: def.description,
              subUnitId: def.subUnitId,
              estimatedHours: def.estimatedHours ? new Prisma.Decimal(def.estimatedHours) : null,
              status: "todo",
              priority: "medium",
            },
          }),
      });
      createdTasks.push(created);
    }

    // Now establish dependencies
    for (let i = 0; i < taskDefs.length; i++) {
      const def = taskDefs[i];
      if (!def) continue;
      if (def.dependenciesByIndex && def.dependenciesByIndex.length > 0) {
        const createdTask = createdTasks[i];
        if (!createdTask) continue;
        const taskId = createdTask.id;
        for (const depIndex of def.dependenciesByIndex) {
          if (depIndex >= 0 && depIndex < createdTasks.length) {
            const depTask = createdTasks[depIndex];
            if (depTask) {
              await db.taskDependency.create({
                data: {
                  taskId,
                  dependsOnTaskId: depTask.id,
                },
              });
            }
          }
        }
      }
    }

    await AuditService.log({
      actorId: args.actorId,
      organizationId: project.organizationId,
      action: "project.apply_template",
      entityType: "Project",
      entityId: project.id,
      after: { templateId: template.id, appliedTasks: createdTasks.length },
    });

    return createdTasks;
  }
}
