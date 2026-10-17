import { createContext, useContext, useState, type ReactNode } from "react";

/** What a change to one entity would reach, marked across the views until cleared (R6.41). */
export interface ImpactMarks {
  source: string | null;
  reached: Set<string>;
  mark: (source: string, reached: string[]) => void;
  clear: () => void;
}

const none: ImpactMarks = { source: null, reached: new Set(), mark: () => undefined, clear: () => undefined };
const ImpactContext = createContext<ImpactMarks>(none);

export function useImpact(): ImpactMarks {
  return useContext(ImpactContext);
}

/** Holds the marks for every view of the shell. */
export function WithImpact({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ source: string | null; reached: Set<string> }>({
    source: null,
    reached: new Set(),
  });
  const value: ImpactMarks = {
    ...state,
    mark: (source, reached) => {
      setState({ source, reached: new Set(reached) });
    },
    clear: () => {
      setState({ source: null, reached: new Set() });
    },
  };
  return <ImpactContext.Provider value={value}>{children}</ImpactContext.Provider>;
}

/** A mark beside an entity a marked change would reach. */
export function ImpactMark({ id }: { id: string }) {
  const { source, reached } = useImpact();
  if (!source || !reached.has(id)) return null;
  return (
    <span className="impact-mark" title={`A change to ${source} would reach it`}>
      <span aria-hidden="true">⚑ </span>reached by {source}
    </span>
  );
}

/** The marks in force, and how to clear them; nothing when none is. */
export function ImpactBar() {
  const { source, reached, clear } = useImpact();
  if (!source) return null;
  return (
    <p className="impact-bar" role="status">
      <span aria-hidden="true">⚑ </span>Marked: the {reached.size} entit{reached.size === 1 ? "y" : "ies"} a change to{" "}
      <code>{source}</code> would reach.{" "}
      <button type="button" onClick={clear}>
        Clear
      </button>
    </p>
  );
}
