/**
 * What a file actually is, judged by its opening bytes rather than by what the
 * uploader said it was.
 *
 * The upload allowlist keys on `input.mimeType`, which the client supplies. So
 * the allowlist could be satisfied by declaring "image/png" and sending
 * anything at all — the one check standing between the bucket and arbitrary
 * content was a string the attacker chose.
 *
 * This does not try to identify every format. It identifies the ones with
 * unambiguous magic numbers, and reports "unknown" for everything else — plain
 * text, CSV and Markdown have no signature and must stay uploadable. The rule
 * is therefore "contradiction rejects", not "only recognised types allowed":
 * silence is not evidence, but a JPEG claiming to be a PDF is.
 */

type Signature = { mime: string; offset: number; bytes: number[] };

/** Longest signatures first, so a more specific match wins. */
const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] },
  // RIFF....WEBP — the "WEBP" tag sits at offset 8.
  { mime: "image/webp", offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  // ftyp box for MP4/HEIC family.
  { mime: "video/mp4", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
  // Zip container: docx, xlsx, pptx and plain zip all start here.
  { mime: "application/zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  // Legacy Office compound document: .doc, .xls, .ppt.
  { mime: "application/x-ole-storage", offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];

/**
 * Declared types that legitimately share one container, so a match on the
 * container is not a contradiction.
 */
const CONTAINER_FAMILIES: Record<string, string[]> = {
  "application/zip": [
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  "application/x-ole-storage": [
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
  ],
  "video/mp4": ["video/mp4", "video/quicktime", "image/heic"],
};

export function sniffMimeType(head: Uint8Array): string | null {
  for (const signature of SIGNATURES) {
    const end = signature.offset + signature.bytes.length;
    if (head.length < end) continue;
    const matches = signature.bytes.every((byte, i) => head[signature.offset + i] === byte);
    if (matches) return signature.mime;
  }
  return null;
}

/**
 * True when the declared type is compatible with what the bytes say.
 *
 * Unknown content is compatible with anything — see the note above about
 * signature-less formats.
 */
export function isDeclaredTypeConsistent(declared: string, head: Uint8Array): boolean {
  const detected = sniffMimeType(head);
  if (detected === null) return true;
  if (detected === declared) return true;

  const family = CONTAINER_FAMILIES[detected];
  if (family?.includes(declared)) return true;

  // An SVG is XML and has no binary signature, so it lands in `detected: null`
  // above and is allowed through here. It is constrained by the allowlist's
  // size cap and served from the storage origin rather than the app's, so it
  // cannot script against a session.
  return false;
}

export function describeMismatch(declared: string, head: Uint8Array): string {
  const detected = sniffMimeType(head);
  return `The file was uploaded as ${declared} but its contents are ${detected ?? "unrecognised"}. It has been discarded.`;
}
