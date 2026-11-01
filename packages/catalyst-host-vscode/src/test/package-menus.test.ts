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
    assert.strictEqual(entry.group, "navigation@3");
  });
});
