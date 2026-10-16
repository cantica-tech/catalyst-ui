import { useState } from "react";

/** The clipboard, when the page may write to it. */
export function clipboardCopy(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/** A button that copies `text` and says, politely, whether it did. */
export function CopyButton({ text, copy = clipboardCopy }: { text: string; copy?: (text: string) => Promise<void> }) {
  const [said, setSaid] = useState("");
  return (
    <>
      <button
        type="button"
        aria-label={`Copy ${text}`}
        onClick={() => {
          copy(text).then(
            () => {
              setSaid("Copied");
            },
            () => {
              setSaid("Could not copy: select the command instead");
            },
          );
        }}
      >
        Copy
      </button>{" "}
      <span className="muted" aria-live="polite">
        {said}
      </span>
    </>
  );
}
