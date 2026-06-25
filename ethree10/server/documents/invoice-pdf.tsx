import React from "react";
import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { BrandDocument, BRAND, formatPdfMoney } from "./brand-layout";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceDocumentProps {
  code: string;
  currency: string;
  status: string;
  billedTo: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  lineItems: InvoiceLineItem[];
  /** Optional data-URL of a QR code linking to the public invoice page. */
  qrDataUrl?: string;
  /** Public URL shown beneath the QR. */
  publicUrl?: string;
}

const styles = StyleSheet.create({
  billRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  label: { fontSize: 8, color: BRAND.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  billName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND.navy },
  meta: { fontSize: 9, color: BRAND.navy, marginBottom: 2 },
  table: { marginTop: 26, borderTopWidth: 1, borderTopColor: BRAND.navy },
  th: { flexDirection: "row", backgroundColor: BRAND.panel, paddingVertical: 6, paddingHorizontal: 6 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND.muted, textTransform: "uppercase" },
  tr: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  cDesc: { flex: 4 },
  cQty: { flex: 1, textAlign: "right" },
  cPrice: { flex: 2, textAlign: "right" },
  cTotal: { flex: 2, textAlign: "right" },
  cell: { fontSize: 9, color: BRAND.navy },
  totals: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: BRAND.navy },
  grandText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND.navy },
  qrWrap: { marginTop: 30, flexDirection: "row", alignItems: "center" },
  qr: { width: 72, height: 72 },
  qrText: { fontSize: 8, color: BRAND.muted, marginLeft: 10, maxWidth: 200 },
  statusPaid: { color: BRAND.teal, fontFamily: "Helvetica-Bold" },
});

const fmtDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(d) : "—";

/** Sum line items (quantity × unit price). Exported for reuse and testing. */
export function sumLineItems(items: InvoiceLineItem[]): number {
  return items.reduce((acc, li) => acc + li.quantity * li.unitPrice, 0);
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const subtotal = sumLineItems(props.lineItems);
  return (
    <BrandDocument docType="INVOICE" code={props.code} dateLabel={`Issued ${fmtDate(props.issuedAt)}`}>
      <View style={styles.billRow}>
        <View>
          <Text style={styles.label}>Billed To</Text>
          <Text style={styles.billName}>{props.billedTo}</Text>
        </View>
        <View>
          <Text style={styles.meta}>Due: {fmtDate(props.dueAt)}</Text>
          <Text style={styles.meta}>
            Status:{" "}
            <Text style={props.status === "paid" ? styles.statusPaid : undefined}>
              {props.status.toUpperCase()}
            </Text>
          </Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.thText, styles.cDesc]}>Description</Text>
          <Text style={[styles.thText, styles.cQty]}>Qty</Text>
          <Text style={[styles.thText, styles.cPrice]}>Unit Price</Text>
          <Text style={[styles.thText, styles.cTotal]}>Amount</Text>
        </View>
        {props.lineItems.map((li, i) => (
          <View style={styles.tr} key={i}>
            <Text style={[styles.cell, styles.cDesc]}>{li.description}</Text>
            <Text style={[styles.cell, styles.cQty]}>{li.quantity}</Text>
            <Text style={[styles.cell, styles.cPrice]}>{formatPdfMoney(li.unitPrice, props.currency)}</Text>
            <Text style={[styles.cell, styles.cTotal]}>{formatPdfMoney(li.quantity * li.unitPrice, props.currency)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.cell}>Subtotal</Text>
            <Text style={styles.cell}>{formatPdfMoney(subtotal, props.currency)}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandText}>Total</Text>
            <Text style={styles.grandText}>{formatPdfMoney(subtotal, props.currency)}</Text>
          </View>
        </View>
      </View>

      {props.qrDataUrl ? (
        <View style={styles.qrWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={props.qrDataUrl} style={styles.qr} />
          <Text style={styles.qrText}>
            Scan to view or pay this invoice online.{props.publicUrl ? `\n${props.publicUrl}` : ""}
          </Text>
        </View>
      ) : null}
    </BrandDocument>
  );
}
