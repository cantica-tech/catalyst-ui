/** The Studio (catalyst roadmap R6.2): one bundle every host shows, reading catalyst only over its HTTP API. */
export { applyTheme, Shell, useNavigate, type Navigate, type Theme, type View } from "./Shell.js";
export { Status, type StatusTone } from "./Status.js";
export {
  ApiError,
  connectionFromPage,
  parseBatch,
  StudioClient,
  type CheckReport,
  type EntityType,
  type EntityView,
  type Graph,
  type GraphArtifact,
  type Connection,
  type ChangedFile,
  type Evidence,
  type InboxItem,
  type InboxReport,
  type History,
  type HistoryEntry,
  type JournalEntry,
  type Command,
  type CommandPart,
  type CommandSpec,
} from "./client.js";
export { Overview, OverviewView, type OverviewData } from "./Overview.js";
export { ArtifactList, Artifacts, EntityPage, statusTone } from "./Artifacts.js";
export { Trace, traceTree, type TraceNode } from "./Trace.js";
export { layoutTrace, TraceGraph, TraceGraphView, type TraceLayout } from "./TraceGraph.js";
export { fileChange, Inbox, inboxGroups, InboxItemPage, InboxList, isCommand } from "./Inbox.js";
export { describeEvidence } from "./evidence.js";
export {
  COMMAND_SEARCH_ID,
  CommandPage,
  Commands,
  composeCommand,
  paletteEntries,
  PaletteSearch,
  searchPalette,
  type PaletteEntry,
} from "./Commands.js";
export { diffStat, hunks, lineDiff, type DiffLine, type Hunk } from "./diff.js";
export { changeKind, DiffView, EntityHistory } from "./History.js";
export { byDay, filterJournal, fileKind, Journal, JournalTimeline } from "./Journal.js";
export { Board, boardColumns, boardTypes, BoardView, movesFrom, type Column } from "./Board.js";
export { clipboardCopy, CopyButton } from "./Copy.js";
