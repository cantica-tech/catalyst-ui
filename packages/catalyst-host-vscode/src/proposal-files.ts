import { join } from "node:path";
import * as vscode from "vscode";
import { proposalWriteBlockedMessage } from "./webview-protocol.js";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "proposal"
  );
}

/**
 * Writes a PROP- file. Refused in an untrusted workspace (B-11), which
 * stays read-only; returns whether the file was written.
 */
export async function writeProposal(corpusRoot: string, id: string, title: string, content: string): Promise<boolean> {
  const blocked = proposalWriteBlockedMessage(vscode.workspace.isTrusted);
  if (blocked) {
    void vscode.window.showWarningMessage(blocked);
    return false;
  }
  const filePath = join(corpusRoot, "proposals", `${id}-${slugify(title)}.md`);
  await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(content, "utf8"));
  return true;
}
