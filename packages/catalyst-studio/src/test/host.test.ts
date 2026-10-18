import { describe, expect, it } from "vitest";

import { connectHost, type DesktopBridge } from "../host.js";

/** A desktop shell's preload bridge (R6.49): what the page posts, and a way to answer it. */
function bridge(): { win: Window; sent: unknown[]; answer: (m: unknown) => void } {
  const sent: unknown[] = [];
  let listener: (m: unknown) => void = () => undefined;
  const catalystHost: DesktopBridge = {
    post: (m) => {
      sent.push(m);
    },
    subscribe: (l) => {
      listener = l;
    },
  };
  const win = { catalystHost, parent: null } as unknown as Window;
  (win as unknown as { parent: Window }).parent = win; // a top window, as the desktop shell's page is
  return {
    win,
    sent,
    answer: (m) => {
      listener(m);
    },
  };
}

describe("the desktop bridge (R6.49)", () => {
  it("says hello over the bridge and runs actions through it", async () => {
    const b = bridge();
    const connecting = connectHost(b.win, 500);
    expect(b.sent).toEqual([{ catalyst: "studio", type: "hello" }]);
    b.answer({ catalyst: "host", type: "hello", runs: true, actions: true, tries: true });
    const host = await connecting;
    expect(host?.act).toBeDefined();
    expect(host?.tryIt).toBeDefined();
    const done = host?.act?.({ verb: "approve", id: "REQ-000001-Ab3xR9pQ", gate: "g", intent: "ok" });
    const asked = b.sent[1] as { type: string; id: string };
    expect(asked.type).toBe("action");
    b.answer({ catalyst: "host", type: "action-result", id: asked.id, ok: true, output: "{}", error: "" });
    expect(await done).toEqual({ ok: true, output: "{}", error: "" });
  });

  it("is no host when the bridge never answers, and no host in a top window without one", async () => {
    expect(await connectHost(bridge().win, 20)).toBeNull();
    const top = {} as Window;
    (top as unknown as { parent: Window }).parent = top;
    expect(await connectHost(top, 20)).toBeNull();
  });
});
