import type { SlashCommandSpec } from "catalyst-core";
import { useEffect, useState } from "react";

export interface AgentWindowProps {
  projectId: string;
}

/**
 * Not a real pty terminal — a command picker plus a scrolling view of a
 * spawned agent process's piped `stdout`/`stderr`, with a follow-up input
 * box written to its `stdin`. Enough for the common case without a native
 * dependency (`node-pty`) this project's dependency footprint has avoided
 * everywhere else.
 */
export function AgentWindow({ projectId }: AgentWindowProps) {
  const [commands, setCommands] = useState<SlashCommandSpec[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [args, setArgs] = useState("");
  const [output, setOutput] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOutput("");
    setError(null);
    void window.catalyst.listSlashCommands(projectId).then(setCommands);
  }, [projectId]);

  useEffect(() => {
    return window.catalyst.onAgentOutput((event) => {
      if (event.projectId === projectId) {
        setOutput((prev) => prev + event.chunk);
      }
    });
  }, [projectId]);

  const selected = commands.find((cmd) => cmd.name === selectedName);

  async function handleRun() {
    if (!selectedName) return;
    setError(await window.catalyst.runSlashCommand(projectId, selectedName, args));
  }

  async function handleSend() {
    if (!followUp.trim()) return;
    await window.catalyst.sendAgentInput(projectId, followUp);
    setFollowUp("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        <select
          value={selectedName}
          onChange={(e) => {
            setSelectedName(e.target.value);
          }}
        >
          <option value="">Select a command…</option>
          {commands.map((cmd) => (
            <option key={cmd.name} value={cmd.name}>
              /{cmd.name}
              {cmd.description ? ` — ${cmd.description}` : ""}
            </option>
          ))}
        </select>
        {selected?.argumentHint ? (
          <input
            value={args}
            onChange={(e) => {
              setArgs(e.target.value);
            }}
            placeholder={selected.argumentHint}
          />
        ) : null}
        <button onClick={() => void handleRun()} disabled={!selectedName}>
          Run
        </button>
      </div>
      {error ? <p style={{ color: "crimson", margin: "0 8px" }}>{error}</p> : null}
      <pre
        style={{
          flex: 1,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          margin: "0 8px",
        }}
      >
        {output}
      </pre>
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        <input
          style={{ flex: 1 }}
          value={followUp}
          onChange={(e) => {
            setFollowUp(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSend();
          }}
          placeholder="Send input to the agent…"
        />
        <button onClick={() => void handleSend()}>Send</button>
      </div>
    </div>
  );
}
