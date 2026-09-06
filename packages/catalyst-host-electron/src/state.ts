import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface TrackedProject {
  id: string;
  projectRoot: string;
  corpusRoot: string;
}

function isTrackedProject(value: unknown): value is TrackedProject {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.projectRoot === "string" &&
    typeof candidate.corpusRoot === "string"
  );
}

/**
 * Reads the persisted tracked-project list from `stateFilePath`. A missing
 * or unparsable file is a normal empty-state, not an error — the same
 * "no catalyst deployment yet" tolerance `resolveCorpusRoot` applies to a
 * single project, extended here to the whole tracked list.
 */
export function loadTrackedProjects(stateFilePath: string): TrackedProject[] {
  if (!existsSync(stateFilePath)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(stateFilePath, "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrackedProject);
  } catch {
    return [];
  }
}

export function saveTrackedProjects(
  stateFilePath: string,
  projects: TrackedProject[],
): void {
  writeFileSync(stateFilePath, JSON.stringify(projects, null, 2), "utf8");
}

/** Adds a project unless its root is already tracked (no duplicate watchers over the same corpus). */
export function addTrackedProject(
  projects: TrackedProject[],
  projectRoot: string,
  corpusRoot: string,
): TrackedProject[] {
  if (projects.some((p) => p.projectRoot === projectRoot)) return projects;
  return [...projects, { id: randomUUID(), projectRoot, corpusRoot }];
}

export function removeTrackedProject(
  projects: TrackedProject[],
  id: string,
): TrackedProject[] {
  return projects.filter((p) => p.id !== id);
}
