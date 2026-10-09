/**
 * Pure pieces of the host <-> webview protocol, kept out of
 * `extension.ts` so they can be tested without VS Code.
 */

/** The only message a detail webview may send. */
export interface OpenReferenceMessage {
  type: "openReference";
  id: string;
}

const MAX_ID_LENGTH = 200;
// An entity id: letters, digits, '-', '_' and '.', nothing else.
const ENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * Validates a message from a webview (B-02). The webview renders corpus
 * text from a cloned repository, so its messages are untrusted: anything
 * but a bounded `openReference` with an entity-shaped id is dropped.
 */
export function parseWebviewMessage(message: unknown): OpenReferenceMessage | null {
  if (typeof message !== "object" || message === null) return null;
  const msg = message as { type?: unknown; id?: unknown };
  if (msg.type !== "openReference") return null;
  if (typeof msg.id !== "string") return null;
  if (msg.id.length === 0 || msg.id.length > MAX_ID_LENGTH) return null;
  if (!ENTITY_ID.test(msg.id)) return null;
  return { type: "openReference", id: msg.id };
}

/**
 * The open panels (key -> owning corpus root) belonging to `corpusRoot`,
 * in insertion order — the ones to refresh when its watcher fires
 * (B-10). The owner is stored with the panel, never parsed back out of
 * the key, which breaks on paths holding ':' (Windows drive letters).
 */
export function panelKeysFor(owners: ReadonlyMap<string, string>, corpusRoot: string): string[] {
  const keys: string[] = [];
  for (const [key, owner] of owners) if (owner === corpusRoot) keys.push(key);
  return keys;
}

/**
 * `null` when proposal files may be written, else the message to show
 * (B-11): an untrusted workspace stays read-only.
 */
export function proposalWriteBlockedMessage(isTrusted: boolean): string | null {
  return isTrusted
    ? null
    : "catalyst writes proposals only in a trusted workspace. Trust this workspace (Manage Workspace Trust) to create a proposal.";
}

/**
 * Content-Security-Policy for every catalyst webview: nothing but the
 * nonce'd bundle and stylesheet, images only from the extension itself.
 */
export function webviewCsp(nonce: string, cspSource: string): string {
  return [
    "default-src 'none'",
    `style-src 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${cspSource} data:`,
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
