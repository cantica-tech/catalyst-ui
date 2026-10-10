/**
 * Compares two dotted-numeric version strings (e.g. `"0.19.0"`) segment by
 * segment, numerically — never lexically, so `"0.9.0" < "0.10.0"` (a plain
 * string compare would get this backwards). A shorter version is padded
 * with `0`s for any missing trailing segment, so `"0.19"` compares equal
 * to `"0.19.0"`. Returns negative/zero/positive, the standard comparator
 * shape. A non-numeric segment (malformed input) compares as `0`, rather
 * than throwing — catalyst versions are always plain `X.Y.Z`, but this
 * avoids a crash on unexpected input from a `version.txt` this code
 * doesn't control the contents of.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".");
  const partsB = b.split(".");
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const numA = Number.parseInt(partsA[i] ?? "0", 10) || 0;
    const numB = Number.parseInt(partsB[i] ?? "0", 10) || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}

const SPECIFIER_OPERATORS = [">=", "<=", "==", "!=", ">", "<"] as const;
type SpecifierOperator = (typeof SPECIFIER_OPERATORS)[number];

export interface VersionSpecifier {
  operator: SpecifierOperator;
  version: string;
}

/**
 * Parses one version-specifier clause the same way a `uv.lock`'s
 * `requires-python` field (or a `pyproject.toml` dependency) writes a
 * version constraint — an explicit comparison operator plus a version,
 * e.g. `">=0.31.0"` — rather than a bare number whose meaning (floor?
 * ceiling? exact pin?) has to be inferred from the constant's name.
 * Longer operators are checked first so `>=`/`<=`/`==`/`!=` aren't
 * mistaken for `>`/`<`. Throws on anything else — a malformed
 * catalyst-core-authored constant should fail loudly, unlike a
 * deployment's own `version.txt` (`readDeployedKernelVersion`),
 * which is untrusted input and never throws.
 */
export function parseVersionSpecifier(specifier: string): VersionSpecifier {
  const trimmed = specifier.trim();
  const operator = SPECIFIER_OPERATORS.find((op) => trimmed.startsWith(op));
  if (!operator) {
    throw new Error(
      `Invalid version specifier "${specifier}" — expected one of ${SPECIFIER_OPERATORS.join(", ")} followed by a version.`,
    );
  }
  const version = trimmed.slice(operator.length).trim();
  if (!version) {
    throw new Error(`Invalid version specifier "${specifier}" — no version after "${operator}".`);
  }
  return { operator, version };
}

/** Whether `version` satisfies one specifier clause (see `parseVersionSpecifier`). */
export function satisfiesVersionSpecifier(version: string, specifier: string): boolean {
  const { operator, version: bound } = parseVersionSpecifier(specifier);
  const cmp = compareVersions(version, bound);
  switch (operator) {
    case ">=":
      return cmp >= 0;
    case "<=":
      return cmp <= 0;
    case ">":
      return cmp > 0;
    case "<":
      return cmp < 0;
    case "==":
      return cmp === 0;
    case "!=":
      return cmp !== 0;
  }
}

/**
 * Evaluates whether `kernelVersion` satisfies a UV-style version constraint string,
 * such as `">=0.33.0"`, `">=0.1.0, <1.0.0"`, `"==0.33.0"`, or `"~=0.33.0"`.
 * Supports multi-clause comma-separated specifiers.
 */
export function satisfiesUvVersionSpecifier(kernelVersion: string, specifierString: string): boolean {
  const trimmed = specifierString.trim();
  if (!trimmed || trimmed === "*") return true;

  const clauses = trimmed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return clauses.every((clause) => {
    if (clause.startsWith("~=")) {
      const baseVersion = clause.slice(2).trim();
      const parts = baseVersion.split(".").map((p) => Number.parseInt(p, 10) || 0);
      if (parts.length >= 2) {
        const nextParts = [...parts];
        nextParts[nextParts.length - 2] += 1;
        const upperLimit = nextParts.slice(0, -1).join(".");
        return compareVersions(kernelVersion, baseVersion) >= 0 && compareVersions(kernelVersion, upperLimit) < 0;
      }
      return compareVersions(kernelVersion, baseVersion) >= 0;
    }

    return satisfiesVersionSpecifier(kernelVersion, clause);
  });
}
