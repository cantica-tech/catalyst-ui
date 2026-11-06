import * as assert from "assert";

import { isTurningBug } from "../entity-items.js";
import { Hourglass } from "../hourglass.js";
import { BUG, REQ, artifact, rule } from "./fixtures-entities.js";

/** Waits `ms` milliseconds of real time, for the hourglass's timer to turn. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("a bug under way turns its hourglass until it is closed (REQ-000121-UVqkd7cL)", () => {
  it("turns a bug past its initial state and not closed, and nothing else", () => {
    assert.strictEqual(isTurningBug(artifact("BUG-000001-Ab3xR9pQ", BUG, "Fixed"), BUG), true);
    assert.strictEqual(isTurningBug(artifact("BUG-000001-Ab3xR9pQ", BUG, "Under Review"), BUG), true);
    assert.strictEqual(isTurningBug(artifact("BUG-000001-Ab3xR9pQ", BUG, "Open"), BUG), false); // not started
    assert.strictEqual(isTurningBug(artifact("BUG-000001-Ab3xR9pQ", BUG, "Closed"), BUG), false);
    assert.strictEqual(isTurningBug(artifact("BUG-000001-Ab3xR9pQ", BUG, "WontFix"), BUG), false);
    assert.strictEqual(isTurningBug(artifact("REQ-000001-Ab3xR9pQ", REQ, "Active"), REQ), false); // not a bug
    assert.strictEqual(isTurningBug(rule("br-AUTH-000001-Ab3xR9pQ", "A rule", "⏳ in progress"), undefined), false);
  });

  it("flips the turning elements' frame on its timer and redraws only them", async () => {
    const redrawn: string[][] = [];
    const hourglass = new Hourglass<string>(
      (elements) => redrawn.push(elements),
      () => false,
      10,
    );
    assert.strictEqual(hourglass.show("bug", true), false); // first drawn upright
    hourglass.show("req", false);
    assert.strictEqual(hourglass.running, true);
    await wait(35);
    assert.ok(redrawn.length >= 2, `redrawn ${String(redrawn.length)} time(s)`);
    assert.ok(redrawn.every((r) => r.length === 1 && r[0] === "bug"));
    const frames = new Set([hourglass.show("bug", true), hourglass.show("bug", true)]);
    assert.strictEqual(frames.size, 1); // within one frame, the same answer
    hourglass.dispose();
    assert.strictEqual(hourglass.running, false);
  });

  it("stops when nothing turns, when the view is hidden, and under reduce motion", async () => {
    const redrawn: string[][] = [];
    let reduce = false;
    const hourglass = new Hourglass<string>(
      (elements) => redrawn.push(elements),
      () => reduce,
      10,
    );
    hourglass.show("bug", true);
    hourglass.setVisible(false);
    assert.strictEqual(hourglass.running, false);
    hourglass.setVisible(true);
    assert.strictEqual(hourglass.running, true);
    hourglass.show("bug", false); // closed: no longer turns
    await wait(25);
    assert.strictEqual(hourglass.running, false);
    reduce = true;
    assert.strictEqual(hourglass.show("bug", true), false);
    assert.strictEqual(hourglass.running, false);
    hourglass.dispose();
  });

  it("is never left turned over when it stops", async () => {
    const frames: boolean[] = [];
    let reduce = false;
    const hourglass = new Hourglass<string>(
      () => frames.push(hourglass.show("bug", true)),
      () => reduce,
      10,
    );
    hourglass.show("bug", true);
    await wait(15); // one turn: drawn turned over
    reduce = true;
    await wait(25);
    assert.strictEqual(hourglass.running, false);
    assert.strictEqual(frames.at(-1), false); // its last redraw is upright
    hourglass.dispose();
  });
});
