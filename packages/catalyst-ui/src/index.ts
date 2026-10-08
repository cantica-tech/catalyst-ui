/** This package's version; equals its package.json (tested). */
export const VERSION = "0.38.0";

export { NodeDetail } from "./NodeDetail.js";
export type { NodeDetailProps } from "./NodeDetail.js";
export { KernelVersionHeader } from "./KernelVersionHeader.js";
export type { FrameworkVersionHeaderProps } from "./KernelVersionHeader.js";
export { VersionControlIcon } from "./VersionControlIcon.js";
export type { VersionControlIconProps } from "./VersionControlIcon.js";

export {
  linkifyReferences,
  referenceTarget,
  REFERENCE_CLASS,
} from "./references.js";
