import type { NodeDetailPayload } from "catalyst-core";
import { NodeDetail } from "catalyst-ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { GraphView } from "./GraphView.js";
import type { GraphLayout } from "./graph.js";
import type { CatalystApi, ProjectUpdate } from "./preload.js";
import type { TrackedProject } from "./state.js";

declare global {
  interface Window {
    catalyst: CatalystApi;
  }
}

function App() {
  const [projects, setProjects] = useState<TrackedProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [layoutsByProject, setLayoutsByProject] = useState<Record<string, GraphLayout>>({});
  const [detail, setDetail] = useState<NodeDetailPayload | null>(null);
  const [studioError, setStudioError] = useState("");

  useEffect(() => {
    void window.catalyst.listProjects().then(setProjects);
    return window.catalyst.onProjectUpdate((update: ProjectUpdate) => {
      setLayoutsByProject((prev) => ({
        ...prev,
        [update.projectId]: update.layout,
      }));
    });
  }, []);

  async function handleAddProject() {
    const project = await window.catalyst.addProject();
    if (project) setProjects((prev) => [...prev, project]);
  }

  async function handleSelectNode(nodeId: string) {
    if (!selectedProjectId) return;
    setDetail(await window.catalyst.getNodeDetail(selectedProjectId, nodeId));
  }

  async function handleOpenStudio(projectId: string) {
    setStudioError((await window.catalyst.openStudio(projectId)) ?? "");
  }

  const layout = selectedProjectId ? layoutsByProject[selectedProjectId] : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <nav style={{ width: 220, overflow: "auto" }}>
          <button onClick={() => void handleAddProject()}>Add project…</button>
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  onClick={() => {
                    setSelectedProjectId(project.id);
                  }}
                >
                  {project.projectRoot}
                </button>{" "}
                <button onClick={() => void handleOpenStudio(project.id)}>Open Studio</button>
              </li>
            ))}
          </ul>
        </nav>
        <main style={{ flex: 1, overflow: "auto" }}>
          {layout ? (
            <GraphView layout={layout} onSelectNode={(id) => void handleSelectNode(id)} />
          ) : (
            <p>Select a project.</p>
          )}
        </main>
        <aside style={{ width: 320, overflow: "auto" }}>
          {detail ? (
            <NodeDetail node={detail.node} upstream={detail.upstream} downstream={detail.downstream} />
          ) : (
            <p>Select a node.</p>
          )}
        </aside>
      </div>
      <p role="status" style={{ margin: 8 }}>
        {studioError ||
          "Open a project's Studio to work in it: its commands run with your agent, each confirmed here first."}
      </p>
    </div>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
