import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { startAgentRun, type RunEvent } from "../catalyst-source.js";

/** A stand-in for catalyst: records its arguments and prints what it is told to. */
function fakeCatalyst(lines: string[], code = 0, stderr = ""): { command: string[]; seen: string } {
  const dir = mkdtempSync(join(tmpdir(), "agent-run-"));
  const seen = join(dir, "argv.json");
  const script = join(dir, "catalyst.cjs");
  writeFileSync(
    script,
    `require("fs").writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
${lines.map((l) => `console.log(${JSON.stringify(l)});`).join("\n")}
process.stderr.write(${JSON.stringify(stderr)});
process.exit(${String(code)});`,
  );
  return { command: [process.execPath, script], seen };
}

const end = {
  event: "end",
  ok: true,
  turns: 1,
  usage: { input: 1, output: 2, cache_read: 0, cache_write: 0 },
  cost_usd: 0.01,
  duration_ms: 5,
  denied: [],
  result: "fine",
};

describe("startAgentRun (studio-SHELL-000015)", () => {
  it("runs catalyst agent run --json from the project and streams its events", async () => {
    const project = mkdtempSync(join(tmpdir(), "project-"));
    const fake = fakeCatalyst([
      JSON.stringify({ event: "start", agent: "claude-code", command: "check-rules", arguments: "a b" }),
      "not json",
      JSON.stringify({ event: "text", text: "hi" }),
      JSON.stringify(end),
    ]);
    const seen: RunEvent[] = [];
    const run = startAgentRun(project, "check-rules", " a  b ", (e) => seen.push(e), fake.command);
    const last = await run.done;
    expect(seen.map((e) => e.event)).toEqual(["start", "text", "end"]);
    expect(last.result).toBe("fine");
    const { argv, cwd } = JSON.parse(readFileSync(fake.seen, "utf8")) as {
      argv: string[];
      cwd: string;
    };
    expect(argv).toEqual(["agent", "run", "--json", "check-rules", "a", "b"]);
    expect(realpathSync(cwd)).toBe(realpathSync(project));
  });

  it("makes up the end when catalyst gives none, with what it said", async () => {
    const fake = fakeCatalyst([], 2, "catalyst: no run adapter for agent 'codex' yet");
    const seen: RunEvent[] = [];
    const last = await startAgentRun(tmpdir(), "alpha", "", (e) => seen.push(e), fake.command).done;
    expect(seen).toEqual([last]);
    expect(last.ok).toBe(false);
    expect(last.result).toBe("catalyst: no run adapter for agent 'codex' yet");
  });

  it("refuses what is not a command name", () => {
    expect(() => startAgentRun(tmpdir(), "--help", "", () => undefined)).toThrow("not a catalyst command");
    expect(() => startAgentRun(tmpdir(), "../x", "", () => undefined)).toThrow("not a catalyst command");
  });
});
