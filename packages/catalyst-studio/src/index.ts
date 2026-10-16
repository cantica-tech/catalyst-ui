/** The Studio (catalyst roadmap R6.2): one bundle every host shows, reading catalyst only over its HTTP API. */
export { applyTheme, Shell, type Theme, type View } from "./Shell.js";
export { Status, type StatusTone } from "./Status.js";
export {
  ApiError,
  connectionFromPage,
  parseBatch,
  StudioClient,
  type CheckReport,
  type Connection,
  type InboxReport,
} from "./client.js";
export { Overview, OverviewView, type OverviewData } from "./Overview.js";
