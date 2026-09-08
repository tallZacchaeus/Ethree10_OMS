import { describe, it, expect } from "vitest";
import {
  sniffMimeType,
  isDeclaredTypeConsistent,
} from "@/server/services/content-sniff";

const bytes = (...values: number[]) => new Uint8Array(values);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const MP4 = bytes(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70);
const TEXT = new TextEncoder().encode("name,amount\nAda,100\n");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe("magic-byte detection", () => {
  it("identifies the formats with unambiguous signatures", () => {
    expect(sniffMimeType(JPEG)).toBe("image/jpeg");
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(PDF)).toBe("application/pdf");
    expect(sniffMimeType(ZIP)).toBe("application/zip");
    expect(sniffMimeType(WEBP)).toBe("image/webp");
    expect(sniffMimeType(MP4)).toBe("video/mp4");
  });

  it("reports unknown for signature-less content", () => {
    // CSV, plain text and Markdown have no magic number and must stay
    // uploadable, so "unknown" has to be a normal answer rather than a failure.
    expect(sniffMimeType(TEXT)).toBeNull();
    expect(sniffMimeType(SVG)).toBeNull();
  });

  it("does not read past the end of a very short file", () => {
    expect(sniffMimeType(bytes(0xff))).toBeNull();
    expect(sniffMimeType(new Uint8Array())).toBeNull();
  });
});

describe("declared type consistency", () => {
  it("accepts a file that is what it says it is", () => {
    expect(isDeclaredTypeConsistent("image/png", PNG)).toBe(true);
    expect(isDeclaredTypeConsistent("application/pdf", PDF)).toBe(true);
  });

  it("rejects content that contradicts the declared type", () => {
    // The actual attack: satisfy the allowlist with a string, send something else.
    expect(isDeclaredTypeConsistent("image/png", PDF)).toBe(false);
    expect(isDeclaredTypeConsistent("image/jpeg", ZIP)).toBe(false);
    expect(isDeclaredTypeConsistent("application/pdf", JPEG)).toBe(false);
  });

  it("accepts Office formats that legitimately share the zip container", () => {
    for (const declared of [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]) {
      expect(isDeclaredTypeConsistent(declared, ZIP)).toBe(true);
    }
  });

  it("accepts HEIC and quicktime sharing the ftyp container", () => {
    expect(isDeclaredTypeConsistent("image/heic", MP4)).toBe(true);
    expect(isDeclaredTypeConsistent("video/quicktime", MP4)).toBe(true);
  });

  it("lets signature-less content through whatever it claims", () => {
    // Silence is not evidence. Rejecting unknown content would block every CSV.
    expect(isDeclaredTypeConsistent("text/plain", TEXT)).toBe(true);
    expect(isDeclaredTypeConsistent("image/svg+xml", SVG)).toBe(true);
  });

  it("still rejects a zip that claims to be a spreadsheet's legacy cousin", () => {
    // xls is OLE, not zip — a zip declaring itself .xls is a contradiction.
    expect(isDeclaredTypeConsistent("application/vnd.ms-excel", ZIP)).toBe(false);
  });
});
