/**
 * Pure checks for everything the renderer can ask the main process to do
 * (B-02). The renderer shows corpus text from a cloned repository, so it
 * is treated as untrusted: every IPC argument is type-checked and bounded
 * here before main acts on it, and a slash command must be one the
 * project actually provides — a command (or alias) of §4 of its
 * criterion's composed `CODE-OF-CONDUCT.md`, as `discoverSlashCommands`
 * reads it — never a free string.
 */

/** Longest args / follow-up text forwarded to an agent. */
export const MAX_AGENT_TEXT_LENGTH = 2000;
const MAX_ID_LENGTH = 200;
const COMMAND_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Any C0 control character (newline included) or DEL: a newline would
// smuggle a second prompt line into the agent's stdin.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type Checked<T> = ({ ok: true } & T) | { ok: false; error: string };

function checkText(value: unknown, what: string): Checked<{ text: string }> {
  if (typeof value !== "string") return { ok: false, error: `${what} must be text.` };
  if (value.length > MAX_AGENT_TEXT_LENGTH)
    return {
      ok: false,
      error: `${what} is longer than ${MAX_AGENT_TEXT_LENGTH} characters.`,
    };
  if (CONTROL_CHARS.test(value)) return { ok: false, error: `${what} must be a single line of text.` };
  return { ok: true, text: value };
}

export function isProjectId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH && !CONTROL_CHARS.test(value);
}

export function validateSlashCommandRequest(
  projectId: unknown,
  name: unknown,
  args: unknown,
  allowedNames: readonly string[],
): Checked<{ name: string; args: string }> {
  if (!isProjectId(projectId)) return { ok: false, error: "Unknown project." };
  if (typeof name !== "string" || !COMMAND_NAME.test(name)) return { ok: false, error: "Not a slash command name." };
  if (!allowedNames.includes(name))
    return {
      ok: false,
      error: `/${name} is not a command this project provides.`,
    };
  const checked = checkText(args, "Arguments");
  if (!checked.ok) return checked;
  return { ok: true, name, args: checked.text };
}

export function validateAgentInput(projectId: unknown, text: unknown): Checked<{ text: string }> {
  if (!isProjectId(projectId)) return { ok: false, error: "Unknown project." };
  return checkText(text, "Input");
}

/**
 * The window's only page. A strict CSP is the second layer behind the
 * sanitised Markdown renderer: no inline or remote script (only the
 * bundled renderer, by nonce), no plugins, frames, forms or base rewrite.
 * Inline `style` is allowed because React views set style attributes.
 */
export function renderIndexHtml(scriptSrc: string, nonce: string): string {
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline'",
    "img-src data:",
    "connect-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}" src="${scriptSrc}"></script>
</body>
</html>`;
}
