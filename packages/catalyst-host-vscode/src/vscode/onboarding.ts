import type { AgentBinding } from "catalyst-core";
import {
  AGENT_PRESETS,
  defaultChatAgent,
  IGNORE_FILE,
  joinCriterionRepo,
  kernelSyncTarget,
  meetsRequiredKernelVersion,
  parseChatAgents,
  readDeployedKernelVersion,
  REQUIRED_KERNEL_VERSION,
} from "catalyst-core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { invokeChatParticipant, resolveAndInvoke, scanAvailableAgents } from "./agent-bridge.js";
import {
  IGNORED_FOLDERS_SETTING,
  ONBOARDING_DISMISSED_PREFIX,
  SELECT_KERNEL_VERSION_COMMAND,
  SYNC_OFFER_DISMISSED_PREFIX,
} from "../constants.js";
import type { DeploymentTarget } from "./deployments.js";
import { buildInstantiationPrompt, findSiblingFrameworkRepo } from "../framework-discovery.js";
import { syncOfferMessage, type SyncOffer } from "../sync-offer.js";

/**
 * The chat participant for a known, detected coding-agent extension —
 * looked up by scanning installed extensions (`scanAvailableAgents`),
 * never by reading a `*.catalyst` pointer's `agent` field, since the
 * whole point here is resolving one for a project that has no pointer
 * yet. `null` when nothing in `AGENT_PRESETS` is actually installed.
 */
export function detectDefaultAgentBinding(): {
  id: string;
  participant: string;
} | null {
  const detected = scanAvailableAgents();
  for (const [id, preset] of Object.entries(AGENT_PRESETS)) {
    if (detected.some((d) => d.extensionId === preset.extensionId)) {
      return { id, participant: preset.participant };
    }
  }
  return null;
}

/** Whether `folder`'s set-up entry was hidden ("Hide here", remembered per folder). */
export function installOfferHidden(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): boolean {
  return context.workspaceState.get<boolean>(ONBOARDING_DISMISSED_PREFIX + folder.uri.fsPath) === true;
}

/**
 * A workspace folder with no `*.catalyst` pointer file is an entry of the
 * Instances view rather than a notification (REQ-000069-UVqkd7cL);
 * selecting it runs this. The two set-up paths reflect the only two ways a
 * project's catalyst-existence question ever resolves: it's already backed
 * by a repo somewhere (`connectExistingCriterionRepo`, fully code-driven),
 * or it genuinely needs a first-time install
 * (`offerAgentDrivenInstantiation`, which still needs a reasoning agent for
 * BOOTSTRAP.md's judgment calls). Resolves `true` when the folder's entry
 * should go.
 */
export async function offerToInstall(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
): Promise<boolean> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "Set up catalyst…", action: "set-up" as const },
      {
        label: "Never offer here",
        detail: "Writes an empty .catalystignore: every catalyst host and agent leaves this folder alone.",
        action: "never" as const,
      },
      {
        label: "Not in this workspace",
        detail: "Adds the folder to catalyst.ignoredFolders, for you, in this workspace.",
        action: "workspace" as const,
      },
      { label: "Hide here", detail: "Removes this entry from the Instances view.", action: "hide" as const },
    ],
    { placeHolder: `No catalyst deployment found in "${folder.name}".` },
  );

  if (choice?.action === "hide") {
    await context.workspaceState.update(ONBOARDING_DISMISSED_PREFIX + folder.uri.fsPath, true);
    return true;
  }
  if (choice?.action === "never") {
    // The kernel's own opt-out (fw-STRUCTURE-000017): every catalyst host
    // and agent leaves this folder alone, for everyone (REQ-000015-UVqkd7cL).
    writeFileSync(
      join(folder.uri.fsPath, IGNORE_FILE),
      "# This directory is not governed by catalyst (an empty .catalystignore opts it out).\n",
    );
    void vscode.window.showInformationMessage(
      `Wrote ${IGNORE_FILE} in "${folder.name}": catalyst leaves it alone. Commit it to share that choice.`,
    );
    return true;
  }
  if (choice?.action === "workspace") {
    // Personal, this workspace only: catalyst.ignoredFolders.
    const config = vscode.workspace.getConfiguration("catalyst", folder.uri);
    const ignored = config.get<string[]>(IGNORED_FOLDERS_SETTING, []);
    await config.update(IGNORED_FOLDERS_SETTING, [...ignored, folder.uri.fsPath], vscode.ConfigurationTarget.Workspace);
    return true;
  }
  if (choice?.action !== "set-up") return false;

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "Load a specific kernel version in memory",
        detail:
          "Select a specific Catalyst kernel version to load into extension memory and activate a matching UI module.",
        action: "version" as const,
      },
      {
        label: "Connect to an existing criterion repo",
        detail:
          "Clone an already-repoed deployment's branch into ~/.catalyst and write catalyst.toml — no agent involved.",
        action: "connect" as const,
      },
      {
        label: "Create a brand new deployment",
        detail: "First-time instantiation — needs a reasoning agent to follow BOOTSTRAP.md.",
        action: "create" as const,
      },
    ],
    { placeHolder: `How should catalyst be set up for "${folder.name}"?` },
  );
  if (!pick) return false;

  if (pick.action === "version") {
    await vscode.commands.executeCommand(SELECT_KERNEL_VERSION_COMMAND);
  } else if (pick.action === "connect") {
    await connectExistingCriterionRepo(folder);
  } else {
    await offerAgentDrivenInstantiation(folder);
  }
  return false;
}

/**
 * `catalyst criterion join`'s mechanical half, done in code rather than
 * handed to an agent: cloning the branch into the home store
 * (`~/.catalyst/projects/<name>/criterion`) and writing `catalyst.toml`
 * need no judgment calls (kernel 0.48.0, ADR-010).
 */
export async function connectExistingCriterionRepo(folder: vscode.WorkspaceFolder): Promise<void> {
  const repoUrl = await vscode.window.showInputBox({
    title: "Criterion repo",
    prompt: "Git URL of the existing criterion repo",
    placeHolder: "git@github.com:org/criterion.git",
    ignoreFocusOut: true,
  });
  if (!repoUrl) return;

  const branch = await vscode.window.showInputBox({
    title: "Branch to check out",
    prompt: 'Your own "<name>.criterion" branch, or "criterion" itself for single-maintainer mode',
    value: "criterion",
    ignoreFocusOut: true,
  });
  if (!branch) return;

  const agentBinding = detectDefaultAgentBinding();

  try {
    await joinCriterionRepo({
      projectRoot: folder.uri.fsPath,
      repoUrl,
      branch,
      agentId: agentBinding?.id,
    });
    void vscode.window.showInformationMessage(`Connected "${folder.name}" to ${repoUrl} (${branch}).`);
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Couldn't connect to the criterion repo: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * A brand-new deployment still needs a reasoning agent: BOOTSTRAP.md's
 * install procedure has judgment calls (retrofit vs. greenfield,
 * bootstrapping rules from existing code evidence) that aren't
 * mechanically scriptable. What's code-driven now is the dispatch itself:
 * a detected agent extension is picked and invoked directly
 * (`invokeChatParticipant`) instead of copying a prompt to the clipboard
 * and asking the user to paste it in themselves. Clipboard-copy remains
 * only as the last-resort fallback when no known agent extension is
 * detected at all — there's nothing to dispatch to.
 */
export async function offerAgentDrivenInstantiation(folder: vscode.WorkspaceFolder): Promise<void> {
  const frameworkPath =
    findSiblingFrameworkRepo(folder.uri.fsPath) ??
    vscode.workspace.getConfiguration("catalyst").get<string>("frameworkPath");

  if (!frameworkPath) {
    const pick = await vscode.window.showWarningMessage(
      "Couldn't find the catalyst framework repo. Set catalyst.frameworkPath in Settings, or clone it as a sibling of this project.",
      "Open Settings",
    );
    if (pick === "Open Settings") {
      void vscode.commands.executeCommand("workbench.action.openSettings", "catalyst.frameworkPath");
    }
    return;
  }

  const instruction = buildInstantiationPrompt(frameworkPath, folder.uri.fsPath);
  const agentBinding = detectDefaultAgentBinding();

  if (!agentBinding) {
    await vscode.env.clipboard.writeText(instruction);
    void vscode.window.showInformationMessage(
      "No known coding-agent extension detected — instantiation prompt copied to the clipboard instead. Paste it into your agent.",
    );
    return;
  }

  await invokeChatParticipant(agentBinding.participant, "", instruction);
  void vscode.window.showInformationMessage(`Sent the instantiation instruction to ${agentBinding.participant}.`);
}

/** The chat-agent binding to target for a project root: its first configured `chatAgents` entry, or the zero-config default derived from the plain `agent` field. */
export function resolveChatAgentDef(projectRoot: string): AgentBinding | null {
  const chatAgents = parseChatAgents(projectRoot);
  return chatAgents[0] ?? defaultChatAgent(projectRoot);
}

/**
 * A resolved deployment behind the highest catalyst kernel version
 * this extension build has been verified against gets an actionable
 * offer: nothing runs until the
 * user explicitly clicks "Sync now" — `/sync-framework` mutates real
 * deployment files, so this must never fire silently. The dismiss key
 * includes the target version, so a future bump of
 * `VERIFIED_KERNEL_VERSION` (catalyst-core `kernel-version.ts`) re-prompts even if an earlier
 * offer was dismissed.
 *
 * One notification path covers both thresholds on the same scale —
 * never two separate popups for what's really one situation. Below
 * `REQUIRED_KERNEL_VERSION` (`catalyst-core`'s declared floor, a
 * version specifier the same way a `uv.lock`'s `requires-python` states
 * one) the wording says so explicitly, since parsing may actually be
 * wrong, not just missing newer sections; between the required floor
 * and the verified version the wording stays the softer
 * "supports syncing to" — a deployment there parses correctly today,
 * syncing just gets it the newer entity types.
 */
export interface PendingSync extends SyncOffer {
  path: string;
  dismissKey: string;
}

/** `target`'s sync offer, when it is behind and has not dismissed this version (B-08: never a downgrade). */
export function pendingSyncFor(
  context: vscode.ExtensionContext,
  target: DeploymentTarget,
  corpusRoot: string,
): PendingSync | undefined {
  const deployed = readDeployedKernelVersion(corpusRoot);
  const syncTarget = kernelSyncTarget(deployed);
  if (!deployed || !syncTarget) return undefined;
  const dismissKey = `${SYNC_OFFER_DISMISSED_PREFIX}${target.path}:${syncTarget}`;
  if (context.workspaceState.get<boolean>(dismissKey)) return undefined;
  return {
    name: target.name,
    path: target.path,
    deployed,
    target: syncTarget,
    belowRequired: !meetsRequiredKernelVersion(deployed),
    dismissKey,
  };
}

/** Every pending sync in one notification (REQ-000069-UVqkd7cL): "Sync now" syncs each, "Don't ask again" dismisses each. */
export async function offerToSyncKernels(
  context: vscode.ExtensionContext,
  offers: PendingSync[],
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  if (offers.length === 0) return;
  const choice = await vscode.window.showInformationMessage(
    syncOfferMessage(offers, REQUIRED_KERNEL_VERSION),
    "Sync now",
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    for (const offer of offers) await context.workspaceState.update(offer.dismissKey, true);
    return;
  }
  if (choice !== "Sync now") return;

  for (const offer of offers) {
    const agentDef = resolveChatAgentDef(offer.path);
    if (!agentDef) {
      void vscode.window.showErrorMessage(
        `Couldn't determine which agent to chat with for "${offer.name}" — no *.catalyst pointer with an "agent" or "chatAgents" field found.`,
      );
      continue;
    }
    await resolveAndInvoke(agentDef, "/sync-framework", offer.target, outputChannel);
  }
}
