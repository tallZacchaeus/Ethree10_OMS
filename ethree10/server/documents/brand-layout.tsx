import React from "react";
import path from "node:path";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

/**
 * Shared E310-branded document chrome for generated PDFs (invoices, receipts).
 * Composed header (logo + lime accent rule) and footer (contact block) per the
 * E310 letterhead — see IMPLEMENTATION-PLAN.md Appendix A. Brand palette mirrors
 * tailwind.config.ts: navy ink, teal, lime.
 */

export const BRAND = {
  navy: "#051a2c",
  navy800: "#081d30",
  teal: "#05b1a4",
  lime: "#b4d93f",
  muted: "#5e768c",
  panel: "#f3f5f7",
  border: "#c8d2db",
  white: "#ffffff",
} as const;

const LOGO_PATH = path.join(process.cwd(), "public", "e310-black.png");

export const CONTACT = {
  email: "INFO@ETHREE10.COM",
  phones: "+234 807 644 8719  ·  +234 811 181 8476",
  address: "Dare Adeboye Innovation Hub, Abiona Street, House of Favor, Redemption City, Ogun State, Nigeria.",
} as const;

/**
 * Money formatter for PDFs. Uses the ISO currency code prefix (e.g. "NGN
 * 500,000.00") rather than a symbol, so output never depends on a font shipping
 * the ₦ glyph.
 */
export function formatPdfMoney(amount: number, currency = "NGN"): string {
  const value = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${currency} ${value}`;
}

export const docStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 96,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BRAND.navy,
    backgroundColor: BRAND.white,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 96, height: 32, objectFit: "contain" },
  limeRule: { height: 3, backgroundColor: BRAND.lime, marginTop: 10, marginBottom: 4, width: 96 },
  docMeta: { alignItems: "flex-end" },
  docType: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND.navy, letterSpacing: 1 },
  docCode: { fontSize: 11, color: BRAND.teal, fontFamily: "Helvetica-Bold", marginTop: 2 },
  docDate: { fontSize: 9, color: BRAND.muted, marginTop: 2 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: BRAND.border,
    paddingTop: 8,
  },
  footerLine: { fontSize: 8, color: BRAND.muted, textAlign: "center", marginBottom: 2 },
});

interface BrandDocumentProps {
  /** Big label on the top-right, e.g. "INVOICE" or "RECEIPT". */
  docType: string;
  /** Document code, e.g. "INV-AB12CD34". */
  code: string;
  /** Right-aligned date line under the code. */
  dateLabel: string;
  children: React.ReactNode;
}

/** A single-page branded document with the E310 header and footer. */
export function BrandDocument({ docType, code, dateLabel, children }: BrandDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={docStyles.page}>
        <View style={docStyles.header}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={LOGO_PATH} style={docStyles.logo} />
            <View style={docStyles.limeRule} />
          </View>
          <View style={docStyles.docMeta}>
            <Text style={docStyles.docType}>{docType}</Text>
            <Text style={docStyles.docCode}>{code}</Text>
            <Text style={docStyles.docDate}>{dateLabel}</Text>
          </View>
        </View>

        {children}

        <View style={docStyles.footer} fixed>
          <Text style={docStyles.footerLine}>{CONTACT.email}    {CONTACT.phones}</Text>
          <Text style={docStyles.footerLine}>{CONTACT.address}</Text>
        </View>
      </Page>
    </Document>
  );
}
