import type { ApprovalRule, Organization, Request } from "@prisma/client";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";

type ApprovalCondition = {
  isExternal?: boolean;
  minBudget?: number;
};

export class ApprovalService {
  /**
   * Evaluates if a request requires approval based on agency-configured rules.
   * If it does, returns the rule that matched.
   */
  static async checkRules(request: Request, organization: Organization) {
    const rules = await db.approvalRule.findMany({
      where: { isActive: true },
    });

    for (const rule of rules) {
      // Evaluate triggerCondition
      // Example condition: { "isExternal": true, "minBudget": 500000 }
      const condition = rule.triggerCondition as ApprovalCondition | null;
      if (!condition) continue;

      let matched = true;

      if (condition.isExternal !== undefined && organization.isExternal !== condition.isExternal) {
        matched = false;
      }

      if (condition.minBudget && request.budgetEstimate) {
        if (request.budgetEstimate.toNumber() < condition.minBudget) {
          matched = false;
        }
      }

      // Add more dynamic rule evaluations here as needed

      if (matched) return rule;
    }

    return null;
  }

  static async notifyApprovers(rule: ApprovalRule, request: Request) {
    // Approvers are agency staff (org-null memberships) with the required role.
    const approvers = await db.membership.findMany({
      where: {

        role: rule.requiredRole,
        removedAt: null,
      },
      select: { userId: true },
    });

    const userIds = approvers.map((m) => m.userId);

    if (userIds.length > 0) {
      await NotificationService.createMany(userIds, {
        kind: "approval_requested",
        title: `Approval Required: ${rule.name}`,
        body: `Request ${request.code} requires your approval.`,
        link: `/requests/${request.id}`,
        entityType: "Request",
        entityId: request.id,
      });
    }
  }
}
