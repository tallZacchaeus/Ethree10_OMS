import React from "react";
import { Button, Text } from "@react-email/components";
import { EmailLayout } from "@/server/notifications/email/layout";
import { env } from "@/lib/env";

const heading = { fontSize: "18px", fontWeight: 600, color: "#0f172a", margin: "0 0 8px" };
const body = { fontSize: "14px", color: "#334155", lineHeight: "1.55", margin: "0 0 16px" };
const button = {
  backgroundColor: "#06756d",
  color: "#ffffff",
  borderRadius: "8px",
  padding: "10px 18px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
};

export function NotificationEmail({
  title,
  body: message,
  ctaLabel,
  ctaPath,
}: {
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaPath?: string;
}) {
  const appUrl = env.AUTH_URL.replace(/\/$/, "");
  return (
    <EmailLayout preview={title}>
      <Text style={heading}>{title}</Text>
      {message && <Text style={body}>{message}</Text>}
      {ctaPath && (
        <Button href={`${appUrl}${ctaPath}`} style={button}>
          {ctaLabel ?? "Open Ethree10"}
        </Button>
      )}
    </EmailLayout>
  );
}
