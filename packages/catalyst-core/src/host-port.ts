/**
 * What a flow asks of the host it runs in (catalyst roadmap R6.1): VS Code,
 * the Electron shell, or the browser Studio each implement this once, and a
 * flow written against it runs in all of them. Nothing here names a host.
 */

export type NotifyLevel = "info" | "warning" | "error";

/** A project folder the host has open. */
export interface HostFolder {
  name: string;
  path: string;
}

export interface PickItem {
  label: string;
  description?: string;
  detail?: string;
}

export interface PickOptions {
  placeHolder?: string;
  matchOnDescription?: boolean;
}

export interface InputOptions {
  prompt?: string;
  placeHolder?: string;
  value?: string;
}

/** Small persistent state a flow keeps between runs ("don't ask again"). */
export interface HostMemento {
  get(key: string): unknown;
  update(key: string, value: unknown): Promise<void>;
}

export interface HostPort {
  /** Shows a message; resolves to the action the user chose, if any. */
  notify(level: NotifyLevel, message: string, ...actions: string[]): Promise<string | undefined>;
  pick<T extends PickItem>(items: readonly T[], options?: PickOptions): Promise<T | undefined>;
  input(options: InputOptions): Promise<string | undefined>;
  copy(text: string): Promise<void>;
  openExternal(url: string): Promise<boolean>;
  /** Whether the user trusts the open workspace; writes are refused when not. */
  isTrusted(): boolean;
  /** A `catalyst.*` setting, for one folder when given. */
  setting(key: string, folder?: HostFolder): unknown;
  updateSetting(key: string, value: unknown, folder?: HostFolder): Promise<void>;
  /** Runs one of the host's own commands by id. */
  run(command: string, ...args: unknown[]): Promise<unknown>;
  folders(): HostFolder[];
  memento: HostMemento;
}

/** A host that answers from scripts: for tests and headless runs. */
export class ScriptedHost implements HostPort {
  readonly notified: { level: NotifyLevel; message: string }[] = [];
  readonly ran: { command: string; args: unknown[] }[] = [];
  readonly copied: string[] = [];
  readonly settings = new Map<string, unknown>();
  private readonly state = new Map<string, unknown>();
  readonly memento: HostMemento = {
    get: (key: string) => this.state.get(key),
    update: (key: string, value: unknown) => {
      this.state.set(key, value);
      return Promise.resolve();
    },
  };

  constructor(
    private readonly answers: {
      notify?: (string | undefined)[];
      pick?: number[];
      input?: (string | undefined)[];
      folders?: HostFolder[];
      trusted?: boolean;
    } = {},
  ) {}

  notify(level: NotifyLevel, message: string): Promise<string | undefined> {
    this.notified.push({ level, message });
    return Promise.resolve(this.answers.notify?.shift());
  }

  pick<T extends PickItem>(items: readonly T[]): Promise<T | undefined> {
    const index = this.answers.pick?.shift();
    return Promise.resolve(index === undefined || index < 0 ? undefined : items[index]);
  }

  input(): Promise<string | undefined> {
    return Promise.resolve(this.answers.input?.shift());
  }

  copy(text: string): Promise<void> {
    this.copied.push(text);
    return Promise.resolve();
  }

  openExternal(): Promise<boolean> {
    return Promise.resolve(true);
  }

  isTrusted(): boolean {
    return this.answers.trusted ?? true;
  }

  setting(key: string, folder?: HostFolder): unknown {
    return this.settings.get(`${folder?.path ?? ""}:${key}`) ?? this.settings.get(`:${key}`);
  }

  updateSetting(key: string, value: unknown, folder?: HostFolder): Promise<void> {
    this.settings.set(`${folder?.path ?? ""}:${key}`, value);
    return Promise.resolve();
  }

  run(command: string, ...args: unknown[]): Promise<unknown> {
    this.ran.push({ command, args });
    return Promise.resolve(undefined);
  }

  folders(): HostFolder[] {
    return this.answers.folders ?? [];
  }
}
