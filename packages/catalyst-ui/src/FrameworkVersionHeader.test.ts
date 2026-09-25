import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FrameworkVersionHeader } from "./FrameworkVersionHeader.js";

describe("FrameworkVersionHeader", () => {
  it("renders framework version button and details when matching", () => {
    const html = renderToStaticMarkup(
      createElement(FrameworkVersionHeader, {
        versionInfo: {
          version: "0.33.0",
          requiredVersion: ">=0.31.0",
          meetsRequirement: true,
          explanation: "Satisfies requirement",
        },
      }),
    );
    expect(html).toContain("Framework Version");
    expect(html).toContain("<svg");
  });

  it("renders red styling and exclamation mark when version does not match expected", () => {
    const html = renderToStaticMarkup(
      createElement(FrameworkVersionHeader, {
        versionInfo: {
          version: "0.29.0",
          requiredVersion: ">=0.31.0",
          meetsRequirement: false,
          explanation: "Version 0.29.0 is below required version >=0.31.0",
        },
      }),
    );
    expect(html).toContain("Framework Version");
    expect(html).toContain("!");
    expect(html).toContain(
      "Version 0.29.0 is below required version &gt;=0.31.0",
    );
    expect(html).toContain("#ef4444"); // red styling
  });
});
