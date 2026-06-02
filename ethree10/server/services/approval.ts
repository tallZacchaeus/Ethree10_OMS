import { Request, Workspace } from "@prisma/client";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";
import { getAgencyWorkspaceId } from "@/server/services/agency";

export class ApprovalService {
  /**
   * Evaluates if a request requires approval based on agency-configured rules.
   * If it does, returns the rule that matched.
   */
  static async checkRules(request: Request, clientWorkspace: Workspace) {
    const agencyId = await getAgencyWorkspaceId();
    if (!agencyId) return null;

    const rules = await db.approvalRule.findMany({
      where: { workspaceId: agencyId, isActive: true },
    });

    for (const rule of rules) {
      // Evaluate triggerCondition
      // Example condition: { "clientType": "external_client", "minBudget": 500000 }
      const condition = rule.triggerCondition as any;
      if (!condition) continue;

      let matched = true;

      if (condition.clientType && clientWorkspace.type !== condition.clientType) {
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

  static async notifyApprovers(rule: any, request: Request) {
    const agencyId = await getAgencyWorkspaceId();
    if (!agencyId) return;

    // Find users with the required role in the agency workspace
    const approvers = await db.membership.findMany({
      where: {
        workspaceId: agencyId,
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
