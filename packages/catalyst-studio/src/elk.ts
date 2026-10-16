import type { ELK as ElkInstance, ELKConstructorArguments } from "elkjs/lib/elk-api.js";
import ElkBundled from "elkjs/lib/elk.bundled.js";

// elkjs is CommonJS: under NodeNext its default import types as the module,
// while at runtime it is the constructor (and so is `.default`)
type ElkConstructor = new (args?: ELKConstructorArguments) => ElkInstance;
const bundled = ElkBundled as unknown as ElkConstructor & { default?: ElkConstructor };

/** The elkjs layout engine (Studio decision 4), shared by every drawn view. */
export const ELK: ElkConstructor = bundled.default ?? bundled;
