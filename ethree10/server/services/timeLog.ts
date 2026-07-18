import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db/client";

export class TimeLogService {
  static async listForTask(taskId: string) {
    return db.timeLog.findMany({
      where: { taskId },
      orderBy: { date: "desc" },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  static async listForUser(userId: string, fromDate?: Date, toDate?: Date) {
    return db.timeLog.findMany({
      where: {
        userId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: "desc" },
      include: {
        task: { select: { id: true, title: true, code: true, projectId: true } },
      },
    });
  }

  static async addTimeLog(args: {
    actorId: string;
    taskId: string;
    hours: number;
    note?: string;
    date: Date;
  }) {
    if (args.hours <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Hours must be greater than 0" });

    const task = await db.task.findUnique({
      where: { id: args.taskId },
      select: { projectId: true, loggedHours: true },
    });
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

    const timeLog = await db.timeLog.create({
      data: {
        taskId: args.taskId,
        userId: args.actorId,
        hours: new Prisma.Decimal(args.hours),
        note: args.note,
        date: args.date,
      },
    });

    // Update aggregate loggedHours on the Task
    const newTotal = task.loggedHours.toNumber() + args.hours;
    await db.task.update({
      where: { id: args.taskId },
      data: { loggedHours: new Prisma.Decimal(newTotal) },
    });

    return timeLog;
  }
}
