import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const main = { backgroundColor: "#f8fafc", fontFamily: "Inter, Arial, sans-serif" };
const container = {
  margin: "0 auto",
  padding: "24px",
  maxWidth: "560px",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
};
const brand = { color: "#4338ca", fontSize: "20px", fontWeight: 700, margin: "0 0 16px" };
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
          <Text style={brand}>Ethree10</Text>
          <Section>{children}</Section>
          <Hr />
          <Text style={footer}>
            You&apos;re receiving this because you have an Ethree10 account. Manage your
            preferences in{" "}
            <Link href="/settings">notification settings</Link>.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
