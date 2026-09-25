import { describe, expect, it } from "vitest";
import {
  getActiveETDs,
  getDefaultSoftwareEngineeringManifest,
  getGroundingType,
  loadModule,
  resolveCommand,
} from "../module-loader.js";

describe("module-loader", () => {
  it("provides default software-engineering manifest", () => {
    const manifest = getDefaultSoftwareEngineeringManifest();
    expect(manifest.id).toBe("software-engineering");
    expect(manifest.groundingType).toBe("rule");

    const etds = getActiveETDs(manifest);
    expect(etds.has("REQ")).toBe(true);
    expect(etds.has("BUG")).toBe(true);
    expect(etds.has("TEST")).toBe(true);
    expect(etds.has("STEP")).toBe(true);
    expect(etds.has("FEAT")).toBe(true);

    const reqEtd = etds.get("REQ");
    expect(reqEtd?.folder).toBe("requirements");
    expect(reqEtd?.grounding).toBe("required");
    expect(reqEtd?.groundingField).toBe("Targets");

    const stepEtd = etds.get("STEP");
    expect(stepEtd?.grounding).toBe("inherited");
    expect(stepEtd?.groundingField).toBe("Parent");

    expect(getGroundingType(manifest)).toBe("rule");
  });

  it("resolves registered commands", () => {
    const manifest = getDefaultSoftwareEngineeringManifest();
    const cmd = resolveCommand(manifest, "/create-req");
    expect(cmd?.name).toBe("create-req");
    expect(resolveCommand(manifest, "check-rules")?.name).toBe("check-rules");
    expect(resolveCommand(manifest, "unknown")).toBeUndefined();
  });

  it("loads default module for empty project root", () => {
    const manifest = loadModule();
    expect(manifest.id).toBe("software-engineering");
  });

  it("handles non-software module request gracefully", () => {
    const manifest = loadModule(undefined, "sample-process");
    expect(manifest.id).toBe("software-engineering"); // falls back cleanly to default when not found on disk
  });
});
