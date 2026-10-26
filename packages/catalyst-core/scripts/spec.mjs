#!/usr/bin/env node
/**
 * catalyst's `spec/` in this package (R6.50): what each `--json` command
 * prints and `catalyst serve` returns, as JSON Schemas, vendored at one
 * kernel release, and the TypeScript types generated from them.
 *
 *   node scripts/spec.mjs sync <catalyst checkout> <tag>   copy spec/ at that tag, then generate
 *   node scripts/spec.mjs generate                         write src/spec.ts from spec/
 *   node scripts/spec.mjs check                            fail when src/spec.ts is not what generate writes
 *
 * The schemas use few keywords (type, properties, required,
 * additionalProperties, items, enum, const, anyOf, oneOf, $ref to #/$defs); any
 * other that would change a type is refused, so a new one is never silently
 * dropped.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = join(PACKAGE, "spec");
const OUT = join(PACKAGE, "src", "spec.ts");
const IGNORED = new Set(["$schema", "$id", "title", "description", "minimum", "minProperties", "maxProperties"]);
const KNOWN = new Set([
  ...IGNORED,
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "const",
  "anyOf",
  "oneOf",
  "$ref",
  "$defs",
]);

const pascal = (s) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const doc = (text, pad) => {
  if (!text) return "";
  const lines = text.replace(/\*\//g, "*\\/").split("\n");
  return lines.length === 1
    ? `${pad}/** ${lines[0]} */\n`
    : `${pad}/**\n${lines.map((l) => `${pad} * ${l}`.trimEnd()).join("\n")}\n${pad} */\n`;
};

/** The TypeScript type a schema describes; `defs` names each `$defs` entry. */
function type(schema, defs, where, pad = "") {
  if (schema === true || schema === undefined) return "unknown";
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k)) throw new Error(`${where}: the keyword ${k} is not supported`);
  }
  if (schema.$ref) {
    const name = defs[schema.$ref];
    if (!name) throw new Error(`${where}: ${schema.$ref} is not a $defs entry`);
    return name;
  }
  if (schema.anyOf || schema.oneOf) {
    // A union either way: TypeScript cannot say "exactly one". Fields beside it would be dropped, so they are refused.
    const kw = schema.anyOf ? "anyOf" : "oneOf";
    if ((schema.anyOf && schema.oneOf) || schema.properties || schema.items) {
      throw new Error(`${where}: ${kw} beside oneOf/anyOf, properties or items is not supported`);
    }
    return schema[kw].map((s, i) => type(s, defs, `${where}/${kw}/${i}`, pad)).join(" | ");
  }
  if ("const" in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  let kinds = schema.type === undefined ? [] : [].concat(schema.type);
  if (!kinds.length) kinds = schema.properties ? ["object"] : schema.items ? ["array"] : [];
  if (!kinds.length) return "unknown";
  return kinds
    .map((kind) => {
      switch (kind) {
        case "string":
          return "string";
        case "integer":
        case "number":
          return "number";
        case "boolean":
          return "boolean";
        case "null":
          return "null";
        case "array": {
          const item = type(schema.items, defs, `${where}/items`, pad);
          return /^[\w.]+$/.test(item) ? `${item}[]` : `(${item})[]`;
        }
        case "object":
          return object(schema, defs, where, pad);
        default:
          throw new Error(`${where}: the type ${kind} is not supported`);
      }
    })
    .join(" | ");
}

function object(schema, defs, where, pad) {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const extra = schema.additionalProperties;
  const names = Object.keys(props);
  const rest = extra === false ? null : type(extra, defs, `${where}/additionalProperties`, pad);
  if (!names.length) return rest === null ? "Record<string, never>" : `Record<string, ${rest}>`;
  const inner = pad + "  ";
  const fields = names.map((n) => {
    const t = type(props[n], defs, `${where}/properties/${n}`, inner);
    return { line: `${doc(props[n].description, inner)}${inner}${key(n)}${required.has(n) ? "" : "?"}: ${t};`, t };
  });
  const lines = fields.map((f) => f.line);
  if (rest !== null) {
    // an index signature must admit every declared field: a narrower one is widened to unknown
    const fits = rest === "unknown" || fields.every((f) => f.t === rest);
    lines.push(`${inner}[key: string]: ${fits ? rest : "unknown"};`);
  }
  return `{\n${lines.join("\n")}\n${pad}}`;
}

/** A named type: an interface when the schema is one object with fields (the repository's lint), else a type alias. */
function declare(name, schema, defs, where) {
  const t = type(schema, defs, where);
  const single =
    [].concat(schema.type ?? []).join() === "object" && schema.properties && !schema.anyOf && !schema.oneOf;
  return single ? `export interface ${name} ${t}` : `export type ${name} = ${t};`;
}

/** The whole of src/spec.ts, from the schemas in spec/. */
async function generate() {
  const kernel = readFileSync(join(SPEC, "KERNEL"), "utf8").trim();
  const files = readdirSync(SPEC)
    .filter((f) => f.endsWith(".schema.json"))
    .sort();
  let out =
    `/**\n * GENERATED by \`scripts/spec.mjs\` from catalyst ${kernel}'s \`spec/\` (vendored in \`spec/\`): never edit.\n` +
    ` * Each type is what a \`--json\` command prints at that kernel; a field an older kernel lacks is made\n` +
    ` * optional where it is read, never here.\n */\n`;
  for (const file of files) {
    const schema = JSON.parse(readFileSync(join(SPEC, file), "utf8"));
    const base = pascal(file.replace(/\.schema\.json$/, ""));
    const defs = Object.fromEntries(
      Object.keys(schema.$defs ?? {}).map((d) => [`#/$defs/${d}`, `${base}${pascal(d)}Json`]),
    );
    for (const [d, def] of Object.entries(schema.$defs ?? {})) {
      out += `\n${doc(def.description, "")}${declare(`${base}${pascal(d)}Json`, def, defs, `${file}#/$defs/${d}`)}\n`;
    }
    const { $defs: _, ...top } = schema;
    out += `\n${doc(`${schema.title} (\`spec/${file}\`): ${schema.description ?? ""}`, "")}${declare(`${base}Json`, top, defs, file)}\n`;
  }
  const prettier = await import("prettier");
  const options = (await prettier.resolveConfig(OUT)) ?? {};
  return prettier.format(out, { ...options, parser: "typescript" });
}

function sync(checkout, tag) {
  const git = (...args) => execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" });
  const names = git("ls-tree", "--name-only", tag, "spec/")
    .split("\n")
    .filter((p) => p.endsWith(".schema.json"));
  if (!names.length) throw new Error(`no spec/*.schema.json at ${tag} in ${checkout}`);
  rmSync(SPEC, { recursive: true, force: true });
  mkdirSync(SPEC);
  for (const path of names) writeFileSync(join(SPEC, path.slice("spec/".length)), git("show", `${tag}:${path}`));
  writeFileSync(join(SPEC, "KERNEL"), `${tag}\n`);
  return names.length;
}

const [command, ...args] = process.argv.slice(2);
if (command === "sync") {
  if (args.length !== 2) throw new Error("usage: spec.mjs sync <catalyst checkout> <tag>");
  console.log(`spec/: ${sync(args[0], args[1])} schema(s) from catalyst ${args[1]}`);
  writeFileSync(OUT, await generate());
  console.log("wrote src/spec.ts");
} else if (command === "generate") {
  writeFileSync(OUT, await generate());
  console.log("wrote src/spec.ts");
} else if (command === "check") {
  if (readFileSync(OUT, "utf8") !== (await generate())) {
    console.error("src/spec.ts is not what spec/ generates: run `npm run spec:generate -w catalyst-core`");
    process.exit(1);
  }
  console.log("src/spec.ts matches spec/");
} else {
  console.error("usage: spec.mjs sync <catalyst checkout> <tag> | generate | check");
  process.exit(2);
}
