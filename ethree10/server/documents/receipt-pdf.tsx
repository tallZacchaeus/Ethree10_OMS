import React from "react";
import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { BrandDocument, BRAND, formatPdfMoney } from "./brand-layout";

export interface ReceiptDocumentProps {
  code: string;
  currency: string;
  amount: number;
  paidBy: string;
  paymentMethod: string;
  paymentRef: string | null;
  issuedAt: Date;
  invoiceCode?: string | null;
  qrDataUrl?: string;
  publicUrl?: string;
}

const styles = StyleSheet.create({
  paidBanner: {
    marginTop: 26,
    backgroundColor: BRAND.panel,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.lime,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paidLabel: { fontSize: 9, color: BRAND.muted, textTransform: "uppercase", letterSpacing: 1 },
  paidAmount: { fontSize: 20, fontFamily: "Helvetica-Bold", color: BRAND.navy },
  paidWord: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND.teal, letterSpacing: 2 },
  grid: { marginTop: 26 },
  row: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BRAND.border },
  key: { flex: 1, fontSize: 9, color: BRAND.muted },
  val: { flex: 2, fontSize: 9, color: BRAND.navy, fontFamily: "Helvetica-Bold", textAlign: "right" },
  qrWrap: { marginTop: 30, flexDirection: "row", alignItems: "center" },
  qr: { width: 72, height: 72 },
  qrText: { fontSize: 8, color: BRAND.muted, marginLeft: 10, maxWidth: 200 },
});

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(d);

const METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  other: "Other",
};

export function ReceiptDocument(props: ReceiptDocumentProps) {
  return (
    <BrandDocument docType="RECEIPT" code={props.code} dateLabel={`Issued ${fmtDate(props.issuedAt)}`}>
      <View style={styles.paidBanner}>
        <View>
          <Text style={styles.paidLabel}>Amount Paid</Text>
          <Text style={styles.paidAmount}>{formatPdfMoney(props.amount, props.currency)}</Text>
        </View>
        <Text style={styles.paidWord}>PAID</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.row}>
          <Text style={styles.key}>Paid By</Text>
          <Text style={styles.val}>{props.paidBy}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Payment Method</Text>
          <Text style={styles.val}>{METHOD_LABELS[props.paymentMethod] ?? props.paymentMethod}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>Payment Reference</Text>
          <Text style={styles.val}>{props.paymentRef ?? "—"}</Text>
        </View>
        {props.invoiceCode ? (
          <View style={styles.row}>
            <Text style={styles.key}>For Invoice</Text>
            <Text style={styles.val}>{props.invoiceCode}</Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.key}>Date Paid</Text>
          <Text style={styles.val}>{fmtDate(props.issuedAt)}</Text>
        </View>
      </View>

      {props.qrDataUrl ? (
        <View style={styles.qrWrap}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={props.qrDataUrl} style={styles.qr} />
          <Text style={styles.qrText}>
            Scan to verify this receipt online.{props.publicUrl ? `\n${props.publicUrl}` : ""}
          </Text>
        </View>
      ) : null}
    </BrandDocument>
  );
}
