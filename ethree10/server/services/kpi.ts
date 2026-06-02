import { db } from "@/server/db/client";
import { type ReportLevel, type ReportPeriod, type ScorecardConfig } from "@prisma/client";
import { computeDepartmentEvidence, computeAgencyEvidence } from "../reports/evidence";

export type ScorecardItem = {
  key: string;
  label: string;
  weight: number;
  evidence: string;
  target: number;
  scoringFn: "linearAboveTarget" | "boolean" | "linearBelowTarget";
};

export class KpiService {
  static async computeSnapshot(args: {
    config: ScorecardConfig;
    periodStart: Date;
    periodEnd: Date;
    period: ReportPeriod;
  }) {
    const { config, periodStart, periodEnd, period } = args;
    const items = config.items as unknown as ScorecardItem[];
    
    // Fetch evidence based on level
    let evidenceData: Record<string, number> = {};
    if (config.level === "department") {
      evidenceData = await computeDepartmentEvidence(config.scopeId, periodStart, periodEnd);
    } else if (config.level === "agency") {
      evidenceData = await computeAgencyEvidence(periodStart, periodEnd);
    }

    let totalScore = 0;
    const scorecardResult: Record<string, { target: number; actual: number; weight: number; score: number }> = {};

    for (const item of items) {
      const actual = evidenceData[item.evidence] || 0;
      let score = 0;

      if (item.scoringFn === "boolean") {
        score = actual >= item.target ? item.weight : 0;
      } else if (item.scoringFn === "linearAboveTarget") {
        // e.g. actual=0.8, target=0.9, weight=10. score = (0.8/0.9) * 10
        score = Math.min((actual / item.target) * item.weight, item.weight);
      } else {
        // linearBelowTarget (e.g. bug rate)
        score = actual <= item.target ? item.weight : Math.max(0, (1 - (actual - item.target) / item.target) * item.weight);
      }
      
      // Ensure NaN doesn't propagate
      if (isNaN(score)) score = 0;

      totalScore += score;
      scorecardResult[item.key] = {
        target: item.target,
        actual,
        weight: item.weight,
        score: Number(score.toFixed(2)),
      };
    }

    let rating = "Needs Improvement";
    if (totalScore >= 90) rating = "Outstanding";
    else if (totalScore >= 75) rating = "Strong";
    else if (totalScore >= 60) rating = "Satisfactory";

    // Write Snapshot
    const snapshot = await db.kpiSnapshot.upsert({
      where: {
        level_period_scopeId_periodStart: {
          level: config.level,
          period,
          scopeId: config.scopeId,
          periodStart,
        },
      },
      update: {
        scorecard: scorecardResult,
        totalScore,
        rating,
        periodEnd,
      },
      create: {
        level: config.level,
        period,
        scopeId: config.scopeId,
        periodStart,
        periodEnd,
        scorecard: scorecardResult,
        totalScore,
        rating,
      },
    });

    return snapshot;
  }
}
