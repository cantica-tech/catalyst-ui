import { describe, expect, it } from "vitest";

import { defineElement, fetchView, render, statusOf, type EmbeddedView } from "../embed.js";

const view: EmbeddedView = {
  id: "REQ-000001-Ab3xR9pQ",
  type: "REQ",
  title: "Login <script>",
  Status: "`Active`",
  linked_from: [{ id: "STEP-000001-Ab3xR9pQ", field: "Parent" }],
};

describe("the embed (decision B8)", () => {
  it("renders an entity's title, status and citers, escaped", () => {
    const html = render(view);
    expect(html).toContain("Login &lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Active");
    expect(html).toContain("Cited by 1");
    expect(statusOf({ id: "r", type: "rule", status: "✅ working" })).toBe("✅ working");
    expect(render({ id: "x", type: "rule" })).toContain("Nothing cites it.");
  });

  it("reads with the reader's token", async () => {
    const asked: [string, RequestInit | undefined][] = [];
    const fake = ((url: string, init?: RequestInit) => {
      asked.push([url, init]);
      return Promise.resolve(new Response(JSON.stringify(view), { status: 200 }));
    }) as unknown as typeof fetch;
    const got = await fetchView("https://c.example/v1/", "cst_t", "REQ-000001-Ab3xR9pQ", fake);
    expect(got.id).toBe("REQ-000001-Ab3xR9pQ");
    expect(asked[0][0]).toBe("https://c.example/v1/view/REQ-000001-Ab3xR9pQ");
    expect(asked[0][1]?.headers).toEqual({ Authorization: "Bearer cst_t" });
    const refused = (() => Promise.resolve(new Response("", { status: 403 }))) as unknown as typeof fetch;
    await expect(fetchView("https://c.example/v1", "t", "X", refused)).rejects.toThrow("403");
  });

  it("defines the element once and asks for its attributes", async () => {
    defineElement();
    defineElement();
    const el = document.createElement("catalyst-entity");
    document.body.appendChild(el);
    await Promise.resolve();
    expect(el.shadowRoot?.textContent).toContain("needs server, token and entity");
    el.remove();
  });
});
