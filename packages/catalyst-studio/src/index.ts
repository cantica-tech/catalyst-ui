/** The Studio (catalyst roadmap R6.2): one bundle every host shows, reading catalyst only over its HTTP API. */
export { applyTheme, Shell, type Theme, type View } from "./Shell.js";
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
  type InboxReport,
} from "./client.js";
export { Overview, OverviewView, type OverviewData } from "./Overview.js";
export { ArtifactList, Artifacts, EntityPage, statusTone } from "./Artifacts.js";
export { Trace, traceTree, type TraceNode } from "./Trace.js";
export { layoutTrace, TraceGraph, TraceGraphView, type TraceLayout } from "./TraceGraph.js";
