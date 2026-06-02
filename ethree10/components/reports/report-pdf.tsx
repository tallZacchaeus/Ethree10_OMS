import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { format } from "date-fns";

type ReportRecord = {
  level: string;
  period: string;
  periodStart: Date | string;
  periodEnd: Date | string;
  metrics: unknown;
};

type KpiItem = { score: number; weight: number; actual: number | string };

type ScorecardRecord = {
  rating: string | null;
  totalScore: unknown;
  scorecard: unknown;
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#333" },
  header: { marginBottom: 20, borderBottom: "1px solid #ccc", paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 14, color: "#666" },
  section: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, padding: 5, borderBottom: "1px solid #eee" },
  colKey: { fontSize: 12, fontWeight: "bold" },
  colVal: { fontSize: 12 },
});

export const ReportPDF = ({ report, scorecard }: { report: ReportRecord; scorecard?: ScorecardRecord }) => {
  const metrics = (report.metrics ?? {}) as Record<string, unknown>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Ethree10 OMS Report</Text>
          <Text style={styles.subtitle}>
            Level: {report.level.toUpperCase()} | Period: {report.period.toUpperCase()}
          </Text>
          <Text style={styles.subtitle}>
            {format(new Date(report.periodStart), "MMM d, yyyy")} - {format(new Date(report.periodEnd), "MMM d, yyyy")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          {Object.entries(metrics).map(([key, val]) => (
            <View style={styles.row} key={key}>
              <Text style={styles.colKey}>{key}</Text>
              <Text style={styles.colVal}>{String(val)}</Text>
            </View>
          ))}
        </View>

        {scorecard && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KPI Scorecard - {scorecard.rating ?? "N/A"}</Text>
            <Text style={{ fontSize: 14, marginBottom: 10 }}>
              Total Score: {Number(scorecard.totalScore).toFixed(1)} / 100
            </Text>
            {Object.entries(scorecard.scorecard as Record<string, KpiItem>).map(([key, kpi]) => (
              <View style={styles.row} key={key}>
                <Text style={styles.colKey}>{key}</Text>
                <Text style={styles.colVal}>
                  Score: {kpi.score} / {kpi.weight} (Actual: {kpi.actual})
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
};
