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

/** A directory document's link (vscode-IAM-000003-UVqkd7cL): open that user's, role's or group's document. */
export interface OpenDirectoryMessage {
  type: "openDirectory";
  kind: "user" | "role" | "group";
  name: string;
}

const MAX_NAME_LENGTH = 256;
// A username, role name or group path: printable, no control characters.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Validates a directory link's message, untrusted like every webview message; anything else is dropped. */
export function parseDirectoryMessage(message: unknown): OpenDirectoryMessage | null {
  if (typeof message !== "object" || message === null) return null;
  const msg = message as { type?: unknown; kind?: unknown; name?: unknown };
  if (msg.type !== "openDirectory") return null;
  if (msg.kind !== "user" && msg.kind !== "role" && msg.kind !== "group") return null;
  if (typeof msg.name !== "string" || msg.name.length === 0 || msg.name.length > MAX_NAME_LENGTH) return null;
  if (CONTROL.test(msg.name)) return null;
  return { type: "openDirectory", kind: msg.kind, name: msg.name };
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
