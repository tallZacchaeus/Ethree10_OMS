import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer";
import { format } from "date-fns";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", backgroundColor: "#F8FAFC" },
  header: { marginBottom: 24, borderBottomWidth: 2, borderBottomColor: "#3730A3", paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "bold", color: "#1E1B4B" },
  subtitle: { fontSize: 11, color: "#64748B", marginTop: 5 },
  section: { marginBottom: 16, padding: 14, backgroundColor: "#FFFFFF" },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#3730A3", marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 10, color: "#334155", maxWidth: "70%" },
  value: { fontSize: 10, fontWeight: "bold", color: "#0F172A" },
  paragraph: { fontSize: 10, color: "#334155", lineHeight: 1.5, marginBottom: 8 },
});

interface ReportProps {
  type: string;
  period: string;
  scopeName: string;
  periodStart: Date;
  periodEnd: Date;
  metrics: Record<string, unknown>;
  narrative?: Record<string, unknown>;
  version?: number;
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export const ReportDocument = ({ type, period, scopeName, periodStart, periodEnd, metrics, narrative, version }: ReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Ethree10 {humanize(period)} Report</Text>
        <Text style={styles.subtitle}>{humanize(type)}: {scopeName} · Version {version ?? 1}</Text>
        <Text style={styles.subtitle}>{format(periodStart, "MMM d, yyyy")} – {format(periodEnd, "MMM d, yyyy")} · Africa/Lagos</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Outcome and contribution metrics</Text>
        {Object.entries(metrics).map(([key, value]) => (
          <View key={key} style={styles.row}>
            <Text style={styles.label}>{humanize(key)}</Text>
            <Text style={styles.value}>{String(value)}</Text>
          </View>
        ))}
      </View>
      {narrative && <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reviewed narrative</Text>
        {Object.entries(narrative).map(([key, value]) => (
          <View key={key}>
            <Text style={styles.label}>{humanize(key)}</Text>
            <Text style={styles.paragraph}>{String(value)}</Text>
          </View>
        ))}
      </View>}
      <View style={styles.section}>
        <Text style={styles.paragraph}>Effort hours are shown as delivery context and are not treated as a performance score.</Text>
      </View>
    </Page>
  </Document>
);

export async function generatePdfStream(props: ReportProps) {
  return renderToStream(<ReportDocument {...props} />);
}
