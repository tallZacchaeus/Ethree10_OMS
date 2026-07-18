import { type NextRequest, NextResponse } from "next/server";
import { ProposalService } from "@/server/services/proposal";
import { Document, Page, renderToStream, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";

// Basic PDF styles
const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica" },
  header: { fontSize: 24, marginBottom: 20 },
  section: { margin: 10, padding: 10, flexGrow: 1 },
  text: { fontSize: 12, marginBottom: 5 },
  bold: { fontWeight: "bold" },
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const proposal = await ProposalService.getById(id);

    const ProposalDocument = () => (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.section}>
            <Text style={styles.header}>{proposal.title}</Text>
            <Text style={styles.text}>{proposal.summary}</Text>
          </View>
          <View style={styles.section}>
            <Text style={[styles.text, styles.bold]}>Line Items:</Text>
            {(proposal.lineItems as { label: string; qty: number; unitPrice: number | string }[]).map((item, idx) => (
              <Text key={idx} style={styles.text}>
                - {item.label}: {item.qty} x {item.unitPrice} {proposal.currency}
              </Text>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={[styles.text, styles.bold]}>Total: {proposal.total.toString()} {proposal.currency}</Text>
          </View>
        </Page>
      </Document>
    );

    const stream = await renderToStream(<ProposalDocument />);

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="proposal-${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Not Found or Error", { status: 404 });
  }
}
