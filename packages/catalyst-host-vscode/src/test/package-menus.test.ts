import * as assert from "assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The Users panel's login and logout buttons (REQ-000075-UVqkd7cL), as package.json contributes them. */

const ROOT = join(__dirname, "..", "..");

interface MenuEntry {
  command: string;
  when?: string;
  group?: string;
}
interface Command {
  command: string;
  title: string;
  icon?: string | { light: string; dark: string };
}
interface Manifest {
  contributes: { commands: Command[]; menus: Record<string, MenuEntry[]> };
}

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Manifest;
const usersTitle = manifest.contributes.menus["view/title"].filter((m) => m.when?.includes("view == catalystUsers"));
const entry = (command: string) => usersTitle.find((m) => m.command === command);
const order = (m: MenuEntry | undefined) => Number(/^navigation@(\d+)$/.exec(m?.group ?? "")?.[1] ?? NaN);

const ignored = readFileSync(join(ROOT, ".vscodeignore"), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));

/** A command's light and dark icons: both under resources/icons/, present, and not excluded from the .vsix. */
function assertPackagedIcons(id: string, name: string): void {
  const icon = manifest.contributes.commands.find((c) => c.command === id)?.icon;
  assert.ok(icon && typeof icon === "object", `${id} has a light and a dark icon`);
  assert.deepStrictEqual(
    [icon.light, icon.dark],
    [`resources/icons/${name}-light.svg`, `resources/icons/${name}-dark.svg`],
  );
  for (const path of [icon.light, icon.dark]) {
    assert.ok(existsSync(join(ROOT, path)), `${path} exists`);
    assert.ok(
      !ignored.some((pattern) => pattern.startsWith("resources") || pattern.includes(".svg")),
      `${path} is not excluded from the .vsix by .vscodeignore`,
    );
  }
}

describe("the Users panel's login and logout buttons (REQ-000075-UVqkd7cL)", () => {
  it("shows log-in while no one is logged in and log-out while someone is", () => {
    assert.strictEqual(entry("catalyst.iam.login")?.when, "view == catalystUsers && !catalyst.users.loggedIn");
    assert.strictEqual(entry("catalyst.iam.logout")?.when, "view == catalystUsers && catalyst.users.loggedIn");
  });

  it("puts the button left of the refresh", () => {
    const refresh = order(entry("catalyst.users.refresh"));
    assert.ok(order(entry("catalyst.iam.login")) < refresh);
    assert.ok(order(entry("catalyst.iam.logout")) < refresh);
  });

  it("no longer offers the login in a user's context menu", () => {
    const context = manifest.contributes.menus["view/item/context"] ?? [];
    assert.ok(!context.some((m) => m.command === "catalyst.iam.login" || m.command === "catalyst.iam.logout"));
  });

  it("gives both commands light and dark icons that exist and are packaged", () => {
    assertPackagedIcons("catalyst.iam.login", "log-in");
    assertPackagedIcons("catalyst.iam.logout", "log-out");
  });
});

describe("the Instances view's Set Criterion Repo button", () => {
  it("is titled Set Criterion Repo, with its own light and dark icons, in the view's title bar", () => {
    const command = manifest.contributes.commands.find((c) => c.command === "catalyst.configureCriterion");
    assert.strictEqual(command?.title, "Catalyst: Set Criterion Repo…");
    assertPackagedIcons("catalyst.configureCriterion", "upload-repo");
    const entry = manifest.contributes.menus["view/title"].find((m) => m.command === "catalyst.configureCriterion");
    assert.strictEqual(entry?.when, "view == catalystChainInspector");
    assert.strictEqual(entry.group, "navigation@4");
  });
});

interface Keybinding {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}
const command = (id: string) =>
  (manifest.contributes.commands as (Command & { category?: string; enablement?: string })[]).find(
    (c) => c.command === id,
  );

describe("Catalyst: Search Items (REQ-000076-UVqkd7cL)", () => {
  it("is a search button first in the Instances view's title bar", () => {
    assert.deepStrictEqual(command("catalyst.searchInstances"), {
      command: "catalyst.searchInstances",
      title: "Search Items",
      category: "Catalyst",
      icon: "$(search)",
    });
    const instances = manifest.contributes.menus["view/title"].filter(
      (m) => m.when === "view == catalystChainInspector",
    );
    const sorted = [...instances].sort((a, b) => order(a) - order(b));
    assert.strictEqual(sorted[0].command, "catalyst.searchInstances");
    assert.strictEqual(new Set(instances.map(order)).size, instances.length, "each button its own place");
  });

  it("is bound to Ctrl+Alt+F (Cmd+Alt+F) while the Instances view has focus", () => {
    const bindings = (manifest.contributes as unknown as { keybindings: Keybinding[] }).keybindings;
    assert.deepStrictEqual(
      bindings.filter((k) => k.command === "catalyst.searchInstances"),
      [
        {
          command: "catalyst.searchInstances",
          key: "ctrl+alt+f",
          mac: "cmd+alt+f",
          when: "focusedView == catalystChainInspector",
        },
      ],
    );
  });
});

describe("Close Bug and Reopen Bug (REQ-000077-UVqkd7cL)", () => {
  const context = manifest.contributes.menus["view/item/context"] ?? [];
  const when = (id: string) => context.find((m) => m.command === id)?.when;
  const V = "view == catalystChainInspector";

  it("shows Close on an open bug and Reopen on a closed one, in a trusted workspace", () => {
    assert.strictEqual(
      when("catalyst.closeBug"),
      `${V} && viewItem == catalystEntity.bug.open.allowed && isWorkspaceTrusted`,
    );
    assert.strictEqual(
      when("catalyst.reopenBug"),
      `${V} && viewItem == catalystEntity.bug.closed.allowed && isWorkspaceTrusted`,
    );
    assert.strictEqual(command("catalyst.closeBug")?.title, "Close Bug");
    assert.strictEqual(command("catalyst.reopenBug")?.title, "Reopen Bug");
  });

  it("shows them greyed out, saying why, where catalyst would refuse the signer /status", () => {
    assert.strictEqual(
      when("catalyst.closeBug.denied"),
      `${V} && viewItem == catalystEntity.bug.open.denied && isWorkspaceTrusted`,
    );
    assert.strictEqual(
      when("catalyst.reopenBug.denied"),
      `${V} && viewItem == catalystEntity.bug.closed.denied && isWorkspaceTrusted`,
    );
    for (const id of ["catalyst.closeBug.denied", "catalyst.reopenBug.denied"]) {
      assert.strictEqual(command(id)?.enablement, "false");
      assert.match(command(id)?.title ?? "", /\(needs the \/status grant\)$/);
    }
    for (const id of ["catalyst.closeBug", "catalyst.reopenBug"])
      assert.strictEqual(command(id)?.enablement, undefined);
  });

  it("keeps all four out of the Command Palette: they act on a node", () => {
    const palette = manifest.contributes.menus.commandPalette;
    for (const id of [
      "catalyst.closeBug",
      "catalyst.reopenBug",
      "catalyst.closeBug.denied",
      "catalyst.reopenBug.denied",
    ])
      assert.strictEqual(palette.find((m) => m.command === id)?.when, "false");
  });
});
