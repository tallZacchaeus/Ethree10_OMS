import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer";
import type { MemberMetrics, SubUnitMetrics } from "@/server/services/report";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#F8FAFC" },
  header: { marginBottom: 30, borderBottomWidth: 2, borderBottomColor: "#3730A3", paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E1B4B" },
  subtitle: { fontSize: 12, color: "#64748B", marginTop: 5 },
  section: { marginBottom: 20, padding: 15, backgroundColor: "#FFFFFF", borderRadius: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#3730A3", marginBottom: 15 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 12, color: "#334155" },
  value: { fontSize: 12, fontWeight: "bold", color: "#0F172A" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#CBD5E1", paddingBottom: 5, marginBottom: 5 },
  tableCell: { fontSize: 10, flex: 1, color: "#64748B" },
  tableValue: { fontSize: 10, flex: 1, color: "#0F172A" },
});

interface ReportProps {
  type: "member" | "subunit";
  scopeName: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: any;
}

export const ReportDocument = ({ type, scopeName, periodStart, periodEnd, metrics }: ReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Ethree10 Weekly Report</Text>
        <Text style={styles.subtitle}>
          {type === "member" ? "Member: " : "Sub-unit: "} {scopeName}
        </Text>
        <Text style={styles.subtitle}>
          {format(new Date(periodStart), "MMM d, yyyy")} – {format(new Date(periodEnd), "MMM d, yyyy")}
        </Text>
      </View>

      {type === "member" ? (
        <MemberReport metrics={metrics as MemberMetrics} />
      ) : (
        <SubUnitReport metrics={metrics as SubUnitMetrics} />
      )}
    </Page>
  </Document>
);

const MemberReport = ({ metrics }: { metrics: MemberMetrics }) => (
  <View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Performance Overview</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Tasks Completed</Text>
        <Text style={styles.value}>{metrics.tasksCompleted}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>On-Time Rate</Text>
        <Text style={styles.value}>{(metrics.onTimeRate * 100).toFixed(0)}%</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Hours Logged</Text>
        <Text style={styles.value}>{metrics.hoursLogged}</Text>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Backlog Status</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Open Tasks</Text>
        <Text style={styles.value}>{metrics.openTasks}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Tasks Overdue</Text>
        <Text style={styles.value}>{metrics.tasksOverdue}</Text>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Engagement</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Comments Posted</Text>
        <Text style={styles.value}>{metrics.commentsPosted}</Text>
      </View>
    </View>
  </View>
);

const SubUnitReport = ({ metrics }: { metrics: SubUnitMetrics }) => (
  <View>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sub-unit Overview</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Total Members</Text>
        <Text style={styles.value}>{metrics.members}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Tasks Completed</Text>
        <Text style={styles.value}>{metrics.tasksCompleted}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>On-Time Rate</Text>
        <Text style={styles.value}>{(metrics.onTimeRate * 100).toFixed(0)}%</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Blocked Tasks</Text>
        <Text style={styles.value}>{metrics.blockers}</Text>
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Top Performers</Text>
      <View style={styles.tableHeader}>
        <Text style={{ ...styles.tableCell, flex: 2 }}>Name</Text>
        <Text style={styles.tableCell}>Completed</Text>
      </View>
      {metrics.topPerformers?.length === 0 && (
        <Text style={{ ...styles.tableCell, marginTop: 10 }}>No completions this week.</Text>
      )}
      {metrics.topPerformers?.map((p: any, idx: number) => (
        <View key={idx} style={{ ...styles.row, marginTop: 5 }}>
          <Text style={{ ...styles.tableValue, flex: 2 }}>{p.name}</Text>
          <Text style={styles.tableValue}>{p.completed}</Text>
        </View>
      ))}
    </View>
  </View>
);

export async function generatePdfStream(props: ReportProps) {
  return await renderToStream(<ReportDocument {...props} />);
}
