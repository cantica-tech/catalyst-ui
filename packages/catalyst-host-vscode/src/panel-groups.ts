/**
 * Where a new detail panel opens (`REQ-000013-UVqkd7cL`): at most one
 * editor group per project — or one group for every project — instead of
 * a new group per click.
 *
 * `vscode.ViewColumn.Beside` means "beside the focused group": opened from
 * inside a detail panel, it creates yet another group each time. So only a
 * project's first panel opens beside the active editor; every later one
 * joins the group its project's panels are in, as a tab. Pure, so the
 * placement is unit-tested without a VS Code host.
 */

export type PanelGrouping = "perProject" | "single";

export const PANEL_GROUPING_SETTING = "detailPanelGroups";

export interface OpenDetailPanel {
  /** The deployment (corpus root) the panel shows something from. */
  project: string;
  /** The editor group (view column) it is in now; undefined while hidden. */
  column: number | undefined;
  /** When it was last focused (a monotonic counter or timestamp). */
  lastActive: number;
}

/**
 * The column a new panel for `project` should open in, or "beside" when
 * no panel it should join is open: the group of the most recently focused
 * panel of the same project (`perProject`) or of any project (`single`).
 * Following the last-focused panel respects a user who moved panels.
 */
export function targetColumn(
  open: readonly OpenDetailPanel[],
  project: string,
  grouping: PanelGrouping,
): number | "beside" {
  let best: OpenDetailPanel | undefined;
  for (const panel of open) {
    if (panel.column === undefined) continue;
    if (grouping === "perProject" && panel.project !== project) continue;
    if (!best || panel.lastActive > best.lastActive) best = panel;
  }
  return best?.column ?? "beside";
}

export function readGrouping(value: unknown): PanelGrouping {
  return value === "single" ? "single" : "perProject";
}
