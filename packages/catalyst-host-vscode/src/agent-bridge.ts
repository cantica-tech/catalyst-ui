import type { AgentBinding, DetectedAgent } from "catalyst-core";
import { declaresCommand, findExactMatch, resolveBinding } from "catalyst-core";
import * as vscode from "vscode";

const OVERRIDES_KEY = "catalystAgentOverrides";

/**
 * Both a chat participant's name and its declared slash commands are
 * static data in its own manifest (`contributes.chatParticipants[]` and
 * its nested `commands[]`) — readable via `vscode.extensions.all` with no
 * activation required. Run fresh on each resolution attempt (cheap — a
 * manifest read, not activation) rather than caching at extension
 * startup, so a newly installed/enabled extension is picked up without a
 * Catalyst reload.
 */
export function scanAvailableAgents(): DetectedAgent[] {
  return vscode.extensions.all
    .filter((ext) => ext.packageJSON?.contributes?.chatParticipants)
    .flatMap((ext): DetectedAgent[] =>
      ext.packageJSON.contributes.chatParticipants.map(
        (p: { name: string; commands?: { name: string }[] }) => ({
          extensionId: ext.id,
          participant: `@${p.name}`,
          commands: (p.commands ?? []).map((c) => c.name),
          active: ext.isActive,
        }),
      ),
    );
}

export function scanAvailableCommands(): Thenable<string[]> {
  return vscode.commands.getCommands(true);
}

/** Drives the Chat view; auth is entirely the target extension's problem. Fire-and-forget — there's no structured return value. */
export async function invokeChatParticipant(
  participant: string,
  slashCommand: string,
  args: string,
): Promise<void> {
  const query = `${participant} ${slashCommand} ${args}`.trim();
  await vscode.commands.executeCommand("workbench.action.chat.open", {
    query,
    isPartialQuery: false,
  });
}

/** Purely in-process VS Code command dispatch. No auth involved at all. */
export async function invokeCommand(
  commandId: string,
  args: string,
): Promise<void> {
  await vscode.commands.executeCommand(commandId, args);
}

/**
 * Calls a generic model exposed by whichever extension provides one —
 * **not** a specific agent's own slash-command behavior, tools, or system
 * prompt. Reserve for cases needing a programmatic result, never as the
 * default routing path. `vscode.lm` may not exist on an older VS Code
 * than this extension's declared minimum (the API landed after
 * `engines.vscode`'s current floor) — treated the same as "no models
 * available" rather than throwing a raw `TypeError`.
 */
export async function invokeLmModel(
  vendor: string | undefined,
  prompt: string,
): Promise<string> {
  if (typeof vscode.lm === "undefined") {
    throw new Error("No language model available");
  }
  const [model] = await vscode.lm.selectChatModels(vendor ? { vendor } : {});
  if (!model) throw new Error("No language model available");
  const response = await model.sendRequest(
    [vscode.LanguageModelChatMessage.User(prompt)],
    {},
    new vscode.CancellationTokenSource().token,
  );
  let result = "";
  for await (const chunk of response.text) result += chunk;
  return result;
}

/**
 * Last resort when `scanAvailableAgents()` finds no chat-participant
 * extensions at all: offer raw language models rather than failing
 * outright. Surfaces its result in the given output channel, since
 * there's no chat view involved for a raw model call.
 */
export async function offerModelFallback(
  slashCommand: string,
  args: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  if (typeof vscode.lm === "undefined") {
    void vscode.window.showErrorMessage(
      "No AI agent or language model is available in this VS Code instance.",
    );
    return;
  }
  const models = await vscode.lm.selectChatModels();
  if (models.length === 0) {
    void vscode.window.showErrorMessage(
      "No AI agent or language model is available in this VS Code instance.",
    );
    return;
  }
  const pick = await vscode.window.showQuickPick(
    models.map((m) => ({
      label: `${m.vendor} / ${m.family}`,
      description: "generic model, not a specific agent",
      model: m,
    })),
    { placeHolder: "No chat agents detected. Use a generic model instead?" },
  );
  if (!pick) return;

  const result = await invokeLmModel(
    pick.model.vendor,
    `${slashCommand} ${args}`.trim(),
  );
  outputChannel.appendLine(result);
  outputChannel.show(true);
}

/**
 * Resolves one `AgentBinding` to something invocable and dispatches on
 * its kind. `command`/`lm-model` bindings are invoked directly (existence
 * is checked for `command`; `lm-model` has no "is it installed" concept
 * beyond `invokeLmModel`'s own failure). `chat-participant` gets the full
 * detection + failsafe flow: an exact detected match is used as-is; a
 * previous substitution remembered for this workspace short-circuits
 * detection entirely; otherwise the user picks a detected substitute
 * (optionally remembered), and no chat-participant extensions at all
 * falls through to `offerModelFallback`.
 */
export async function resolveAndInvoke(
  agentDef: AgentBinding,
  slashCommand: string,
  args: string,
  workspaceState: vscode.Memento,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const resolved = resolveBinding(agentDef);

  if (resolved.kind === "command") {
    const available = await scanAvailableCommands();
    if (!available.includes(resolved.commandId)) {
      void vscode.window.showErrorMessage(
        `Command "${resolved.commandId}" (bound to "${agentDef.name}") isn't registered by any installed extension.`,
      );
      return;
    }
    await invokeCommand(resolved.commandId, args);
    return;
  }

  if (resolved.kind === "lm-model") {
    try {
      const result = await invokeLmModel(
        resolved.vendor,
        `${slashCommand} ${args}`.trim(),
      );
      outputChannel.appendLine(result);
      outputChannel.show(true);
    } catch (err) {
      void vscode.window.showErrorMessage(
        `"${agentDef.name}" has no language model available: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return;
  }

  // chat-participant
  const overrides = workspaceState.get<Record<string, string>>(
    OVERRIDES_KEY,
    {},
  );
  const remembered = overrides[agentDef.name];

  const detected = scanAvailableAgents();
  const target = remembered ?? resolved.participant;
  const exact = findExactMatch(detected, target);

  if (exact) {
    if (!declaresCommand(exact, slashCommand)) {
      void vscode.window.showInformationMessage(
        `${target} doesn't declare ${slashCommand} — sending as plain text.`,
      );
    }
    await invokeChatParticipant(target, slashCommand, args);
    return;
  }

  if (detected.length === 0) {
    await offerModelFallback(slashCommand, args, outputChannel);
    return;
  }

  const requestedCmd = slashCommand.replace(/^\//, "");
  const pick = await vscode.window.showQuickPick(
    detected.map((a) => ({
      label: a.participant,
      description: a.commands.includes(requestedCmd)
        ? `supports ${slashCommand}`
        : `no ${slashCommand} — sent as plain text`,
      detail: a.active ? undefined : "not yet activated",
      agent: a,
    })),
    {
      placeHolder: `"${agentDef.name}" isn't available in this VS Code instance. Use one of these instead?`,
      canPickMany: false,
    },
  );
  if (!pick) return; // user dismissed — do nothing, don't retry silently

  const remember = await vscode.window.showQuickPick(
    ["Yes", "No, just this once"],
    {
      placeHolder: `Remember ${pick.agent.participant} as the substitute for "${agentDef.name}" in this workspace?`,
    },
  );
  if (remember === "Yes") {
    await workspaceState.update(OVERRIDES_KEY, {
      ...overrides,
      [agentDef.name]: pick.agent.participant,
    });
  }

  await invokeChatParticipant(pick.agent.participant, slashCommand, args);
}
