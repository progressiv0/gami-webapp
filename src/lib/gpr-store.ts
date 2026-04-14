/**
 * Syncs GPR JSON to the filesystem alongside the database.
 * Filename: {filename}_{first12ofhash}.gpr.json
 * Config: GPR_STORE_DIR env var (default ./gpr-store)
 */
import fs from "fs";
import path from "path";
import type { GPR } from "./types";

function storeDir(): string {
  return path.resolve(
    process.cwd(),
    process.env.GPR_STORE_DIR ?? "./gpr-store"
  );
}

function ensureDir() {
  const dir = storeDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function buildFilename(gpr: GPR): string {
  const rawFilename = gpr.subject.filename ?? "";
  const namePart = rawFilename
    ? rawFilename.replace(/[/\\]/g, "_").replace(/\s+/g, "_").replace(/\..*$/, "")
    : gpr.id.replace("urn:uuid:", "").replace(/-/g, "");

  const hashHex = gpr.subject.file_hash.replace("sha256:", "");
  const hashPart = hashHex.slice(0, 12);

  return `${namePart}_${hashPart}.gpr.json`;
}

export function syncGprFile(gpr: GPR): void {
  const dir = ensureDir();
  const filename = buildFilename(gpr);
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(gpr, null, 2), "utf-8");
}

export function deleteGprFile(gpr: GPR): void {
  const dir = storeDir();
  const filename = buildFilename(gpr);
  const filepath = path.join(dir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
