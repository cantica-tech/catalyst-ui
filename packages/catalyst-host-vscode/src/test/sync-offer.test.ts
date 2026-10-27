import * as assert from "assert";

import { syncOfferMessage } from "../sync-offer.js";

describe("the sync offers share one notification (REQ-000069-UVqkd7cL)", () => {
  it("reads as before for one instance", () => {
    assert.strictEqual(
      syncOfferMessage([{ name: "a", deployed: "0.100.0", target: "0.117.0", belowRequired: false }], "0.54.0"),
      '"a" is on catalyst 0.100.0; this extension supports syncing to 0.117.0.',
    );
    assert.ok(
      syncOfferMessage([{ name: "a", deployed: "0.50.0", target: "0.117.0", belowRequired: true }], "0.54.0").includes(
        "below the 0.54.0 this extension requires",
      ),
    );
  });

  it("names every instance in one message, calling out those below the required version", () => {
    assert.strictEqual(
      syncOfferMessage(
        [
          { name: "a", deployed: "0.100.0", target: "0.117.0", belowRequired: false },
          { name: "b", deployed: "0.50.0", target: "0.117.0", belowRequired: true },
        ],
        "0.54.0",
      ),
      '2 catalyst instances can sync: "a" (0.100.0 → 0.117.0), "b" (0.50.0 → 0.117.0). "b" is below the 0.54.0 this extension requires — some entities may not parse correctly.',
    );
  });
});
