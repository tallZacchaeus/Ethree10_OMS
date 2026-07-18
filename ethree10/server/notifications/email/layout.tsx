import React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const main = { backgroundColor: "#f3f5f7", fontFamily: "Poppins, Inter, Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
};
const brand = { color: "#031629", fontSize: "20px", fontWeight: 700, margin: "0 0 16px" };
const footer = { color: "#64748b", fontSize: "12px", marginTop: "24px" };

export function EmailLayout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>E310</Text>
          <Section>{children}</Section>
          <Hr />
          <Text style={footer}>
            You&apos;re receiving this update about your E310 request or account.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
