import { readFileSync } from "node:fs";
import { inflateRawSync, deflateRawSync } from "node:zlib";
import { satisfiesUvVersionSpecifier } from "./versioning.js";

export interface UiModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  kernelVersion: string; // UV-style compatibility specifier, e.g. ">=0.33.0"
  entry?: string;
  components?: string[];
}

/**
 * A manifest as read from disk: releases before catalyst 0.35.0 named the
 * kernel compatibility field `frameworkVersion`.
 */
export type RawUiModuleManifest = Partial<UiModuleManifest> & {
  frameworkVersion?: unknown;
};

/** The manifest's kernel specifier, falling back to the legacy `frameworkVersion`. */
export function readManifestKernelVersion(
  json: RawUiModuleManifest,
): string | undefined {
  if (typeof json.kernelVersion === "string" && json.kernelVersion) {
    return json.kernelVersion;
  }
  if (typeof json.frameworkVersion === "string" && json.frameworkVersion) {
    return json.frameworkVersion;
  }
  return undefined;
}

export interface ActiveUiModule {
  manifest: UiModuleManifest;
  source: { type: "zip" | "folder"; path?: string };
  activatedAt: Date;
  kernelVersion: string;
  files: Map<string, Buffer>;
}

export type UiModuleLoadResult =
  { success: true; module: ActiveUiModule } | { success: false; error: string };

/** Simple CRC32 computation for zip archives */
function calculateCrc32(buf: Buffer): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      const bit = (crc ^ byte) & 1;
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Creates a standard PKZip format archive buffer from a map of file paths to content.
 */
export function createZipArchive(files: Map<string, Buffer | string>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralDirectoryEntries: Buffer[] = [];
  let offset = 0;

  for (const [path, val] of files.entries()) {
    const rawData = typeof val === "string" ? Buffer.from(val, "utf8") : val;
    const nameBuf = Buffer.from(path, "utf8");
    const crc = calculateCrc32(rawData);
    const compressed = deflateRawSync(rawData);

    // Local Header
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // Signature
    lh.writeUInt16LE(20, 4); // Version needed
    lh.writeUInt16LE(0, 6); // Flags
    lh.writeUInt16LE(8, 8); // Deflate
    lh.writeUInt16LE(0, 10); // Mod time
    lh.writeUInt16LE(0, 12); // Mod date
    lh.writeUInt32LE(crc, 14); // CRC-32
    lh.writeUInt32LE(compressed.length, 18); // Compressed size
    lh.writeUInt32LE(rawData.length, 22); // Uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26); // Name length
    lh.writeUInt16LE(0, 28); // Extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, compressed);

    // Central Directory Header
    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0); // Signature
    cdh.writeUInt16LE(20, 4); // Made by
    cdh.writeUInt16LE(20, 6); // Version needed
    cdh.writeUInt16LE(0, 8); // Flags
    cdh.writeUInt16LE(8, 10); // Deflate
    cdh.writeUInt16LE(0, 12); // Mod time
    cdh.writeUInt16LE(0, 14); // Mod date
    cdh.writeUInt32LE(crc, 16); // CRC-32
    cdh.writeUInt32LE(compressed.length, 20); // Compressed size
    cdh.writeUInt32LE(rawData.length, 24); // Uncompressed size
    cdh.writeUInt16LE(nameBuf.length, 28); // Name length
    cdh.writeUInt16LE(0, 30); // Extra len
    cdh.writeUInt16LE(0, 32); // Comment len
    cdh.writeUInt16LE(0, 34); // Disk start
    cdh.writeUInt16LE(0, 36); // Internal attr
    cdh.writeUInt32LE(0, 38); // External attr
    cdh.writeUInt32LE(offset, 42); // Offset of local header
    nameBuf.copy(cdh, 46);

    centralDirectoryEntries.push(cdh);
    offset += lh.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cdh of centralDirectoryEntries) {
    centralDirSize += cdh.length;
  }

  // End of Central Directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.size, 8);
  eocd.writeUInt16LE(files.size, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralDirectoryEntries, eocd]);
}

/**
 * Parses a ZIP archive buffer into a file map.
 */
export function readZipArchive(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) {
      break;
    }
    const compression = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataOffset = offset + 30 + nameLen + extraLen;
    const compressedData = buffer.subarray(
      dataOffset,
      dataOffset + compressedSize,
    );

    let fileData: Buffer;
    if (compression === 0) {
      fileData = compressedData;
    } else if (compression === 8) {
      fileData = inflateRawSync(compressedData);
    } else {
      fileData = compressedData;
    }

    if (!name.endsWith("/")) {
      entries.set(name, fileData);
    }

    offset = dataOffset + compressedSize;
  }
  return entries;
}

/**
 * Packages a UI module manifest and source files into a ZIP archive Buffer.
 */
export function packageUiModule(
  manifest: UiModuleManifest,
  files: Map<string, Buffer | string> = new Map(),
): Buffer {
  const fileMap = new Map<string, Buffer | string>(files);
  fileMap.set("manifest.json", JSON.stringify(manifest, null, 2));
  return createZipArchive(fileMap);
}

/**
 * Extracts and parses a UI module manifest and files from a zip buffer or file path.
 */
export function parseUiModuleFromZip(zipSource: Buffer | string): {
  manifest: UiModuleManifest;
  files: Map<string, Buffer>;
} {
  const buffer =
    typeof zipSource === "string" ? readFileSync(zipSource) : zipSource;
  const files = readZipArchive(buffer);

  // Look for manifest.json or ui-module.json or module.json
  let manifestEntry: string | undefined;
  for (const name of ["manifest.json", "ui-module.json", "module.json"]) {
    if (files.has(name)) {
      manifestEntry = name;
      break;
    }
  }

  if (!manifestEntry) {
    // Check nested directory
    for (const key of files.keys()) {
      if (
        key.endsWith("/manifest.json") ||
        key.endsWith("/ui-module.json") ||
        key.endsWith("/module.json")
      ) {
        manifestEntry = key;
        break;
      }
    }
  }

  if (!manifestEntry) {
    throw new Error(
      "UI Module zip archive does not contain a manifest.json or ui-module.json",
    );
  }

  const rawJson = files.get(manifestEntry)!.toString("utf8");
  const json = JSON.parse(rawJson) as RawUiModuleManifest;

  if (!json.id || typeof json.id !== "string") {
    throw new Error("UI Module manifest missing required string field 'id'");
  }
  if (!json.name || typeof json.name !== "string") {
    throw new Error("UI Module manifest missing required string field 'name'");
  }
  if (!json.version || typeof json.version !== "string") {
    throw new Error(
      "UI Module manifest missing required string field 'version'",
    );
  }
  const kernelVersion = readManifestKernelVersion(json);
  if (!kernelVersion) {
    throw new Error(
      "UI Module manifest missing required string field 'kernelVersion'",
    );
  }

  const manifest: UiModuleManifest = {
    id: json.id,
    name: json.name,
    version: json.version,
    description: json.description,
    kernelVersion,
    entry: json.entry,
    components: json.components,
  };

  return { manifest, files };
}

/**
 * Manages the dynamic loading, version validation, and activation of UI modules.
 * Enforces that ONLY ONE UI module is loaded/active at a given time.
 */
export class UiModuleManager {
  private activeModule: ActiveUiModule | null = null;
  private loadedManifests: Map<string, UiModuleManifest> = new Map();

  /**
   * Loads and activates a UI module from a zip buffer or file path, validating
   * kernelVersion against currentKernelVersion using UV-style constraints.
   */
  public loadAndActivateZipModule(
    zipSource: Buffer | string,
    currentKernelVersion: string,
  ): UiModuleLoadResult {
    if (!/^\d+(\.\d+)*$/.test(currentKernelVersion.trim())) {
      // A range such as ">=0.45.0" is a requirement, not the version of a
      // kernel; comparing a module against it gives a meaningless answer.
      return {
        success: false,
        error: `"${currentKernelVersion}" is not a kernel version (expected e.g. 0.45.0).`,
      };
    }
    try {
      const { manifest, files } = parseUiModuleFromZip(zipSource);

      const isCompatible = satisfiesUvVersionSpecifier(
        currentKernelVersion,
        manifest.kernelVersion,
      );

      if (!isCompatible) {
        return {
          success: false,
          error: `Module "${manifest.id}" (${manifest.name} v${manifest.version}) requires catalyst kernel "${manifest.kernelVersion}", but active kernel is "${currentKernelVersion}".`,
        };
      }

      // Deactivate current module to ensure only ONE module is loaded at a time
      if (this.activeModule) {
        this.deactivateActiveModule();
      }

      const active: ActiveUiModule = {
        manifest,
        source: {
          type: "zip",
          path: typeof zipSource === "string" ? zipSource : undefined,
        },
        activatedAt: new Date(),
        kernelVersion: currentKernelVersion,
        files,
      };

      this.activeModule = active;
      this.loadedManifests.set(manifest.id, manifest);

      return { success: true, module: active };
    } catch (err) {
      return {
        success: false,
        error: `Failed to load UI module zip: ${
          err instanceof Error ? err.message : String(err)
        }`,
      };
    }
  }

  public getActiveModule(): ActiveUiModule | null {
    return this.activeModule;
  }

  public deactivateActiveModule(): void {
    if (this.activeModule) {
      this.activeModule = null;
    }
  }

  public getLoadedManifests(): UiModuleManifest[] {
    return Array.from(this.loadedManifests.values());
  }
}
