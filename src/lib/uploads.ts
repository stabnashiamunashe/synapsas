// Upload hardening (OWASP ASVS V12): extension + declared-type allowlist, magic-byte sniffing for binary
// formats, random storage names, and a download policy that never lets a file execute in the app's origin.
import path from "path";

export const MAX_FILE_MB = 25;

/** extension -> acceptable MIME types */
const ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
  odt: ["application/vnd.oasis.opendocument.text"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

const MAGIC: Record<string, (b: Buffer) => boolean> = {
  pdf: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  png: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("latin1")),
  webp: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  xlsx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  pptx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  odt: (b) => b[0] === 0x50 && b[1] === 0x4b,
  ods: (b) => b[0] === 0x50 && b[1] === 0x4b,
  zip: (b) => b[0] === 0x50 && b[1] === 0x4b,
  doc: (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
  xls: (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
  ppt: (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
};

export function extensionOf(name: string) {
  return path.extname(name || "").slice(1).toLowerCase();
}

/** Returns an error message, or null when the file is acceptable. */
export function validateUpload(name: string, declaredType: string, bytes: Buffer): string | null {
  const ext = extensionOf(name);
  if (!ext || !ALLOWED[ext]) return `File type .${ext || "?"} is not allowed. Allowed: ${Object.keys(ALLOWED).join(", ")}`;
  if (/\.(exe|js|html?|svg|php|sh|bat|cmd|msi|jar|dll|scr|vbs|ps1)$/i.test(name) || name.includes("..")) return "That file type is not allowed";
  if (bytes.length === 0) return "File is empty";
  if (bytes.length > MAX_FILE_MB * 1024 * 1024) return `File exceeds ${MAX_FILE_MB} MB`;
  const magic = MAGIC[ext];
  if (magic && !magic(bytes)) return `The contents of ${name} do not match a .${ext} file`;
  if (declaredType && declaredType !== "application/octet-stream" && !ALLOWED[ext].includes(declaredType)) return `Declared type ${declaredType} does not match .${ext}`;
  return null;
}

/** Canonical MIME for serving (never trust the browser-declared one). */
export function safeMimeFor(name: string) {
  return ALLOWED[extensionOf(name)]?.[0] || "application/octet-stream";
}

/** Inline preview is only allowed for formats browsers render without script: images and PDF. */
export function inlineAllowed(name: string) {
  return ["pdf", "png", "jpg", "jpeg", "gif", "webp"].includes(extensionOf(name));
}

/** RFC 5987 filename for Content-Disposition (ASCII fallback + UTF-8). */
export function contentDisposition(kind: "inline" | "attachment", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
