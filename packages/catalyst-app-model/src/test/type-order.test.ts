/** Tests of the reading order of a module's types (`REQ-000122-UVqkd7cL`). */
import { describe, expect, it } from "vitest";

import { orderTypes, restsOn, type OrderableType } from "../type-order.js";

/** A type named `plural` whose single references (`ref`) point at `refs`, and whose lists (`ref-list`) at `lists`. */
function t(plural: string, refs: string[] = [], lists: string[] = []): OrderableType {
  return {
    plural_name: plural,
    fields: [
      { kind: "ref-list", target_type: "rule" },
      { kind: "ref", target_type: "domain" },
      ...refs.map((r) => ({ kind: "ref", target_type: r })),
      ...lists.map((r) => ({ kind: "ref-list", target_type: r })),
    ],
  };
}

/** The software-engineering module's types as catalyst declares them, references both ways included. */
const SE: Record<string, OrderableType> = {
  ADR: t("Decisions", [], ["ADR"]),
  ANALYSIS: t("Analyses"),
  BUG: t("Bugs", [], ["STEP"]),
  FEAT: t("Features", ["RM"], ["REQ"]),
  HK: t("House-keeping Items"),
  RECON: t("Reconciliations", ["WORKFLOW"]),
  REQ: t("Requirements", ["FEAT"], ["STEP", "TEST"]),
  STEP: {
    plural_name: "Steps",
    fields: [
      { kind: "ref", target_type: "REQ|BUG" },
      { kind: "ref-list", target_type: "TEST" },
    ],
  },
  TEST: t("Tests", [], ["REQ", "STEP"]),
  WORKFLOW: t("Workflows"),
};

describe("orderTypes", () => {
  it("lists each type after what it rests on, the rest by plural name", () => {
    expect(orderTypes(Object.keys(SE), (p) => SE[p])).toEqual([
      "ANALYSIS",
      "BUG",
      "ADR",
      "FEAT",
      "REQ",
      "STEP",
      "HK",
      "TEST",
      "WORKFLOW",
      "RECON",
    ]);
  });

  it("orders by plural name when no type rests on another", () => {
    const types: Record<string, OrderableType> = { REQ: t("Requirements"), BUG: t("Bugs") };
    expect(orderTypes(["REQ", "BUG"], (p) => types[p])).toEqual(["BUG", "REQ"]);
  });

  it("waits for every type a type rests on, wherever they come by name", () => {
    const types: Record<string, OrderableType> = { A: t("Alphas"), Z: t("Zetas"), M: t("Mus", ["A", "Z"]) };
    expect(orderTypes(["A", "M", "Z"], (p) => types[p])).toEqual(["A", "Z", "M"]);
  });

  it("ignores a referenced type that is not listed, and orders an undeclared prefix by itself", () => {
    expect(orderTypes(["NOTE", "FEAT"], (p) => SE[p])).toEqual(["FEAT", "NOTE"]);
  });

  it("breaks a cycle of references and still lists every type once", () => {
    const types: Record<string, OrderableType> = { A: t("Alphas", ["B"]), B: t("Betas", ["A"]), C: t("Gammas") };
    const order = orderTypes(["C", "B", "A", "A"], (p) => types[p]);
    expect(order).toEqual(["C", "A", "B"]);
  });
});

describe("restsOn", () => {
  it("reads only single references to listed types other than itself", () => {
    const present = new Set(["REQ", "BUG", "STEP", "TEST"]);
    expect(restsOn("STEP", SE.STEP, present)).toEqual(["REQ", "BUG"]);
    expect(restsOn("REQ", SE.REQ, present)).toEqual([]);
    expect(restsOn("ADR", SE.ADR, new Set(["ADR"]))).toEqual([]);
  });
});
