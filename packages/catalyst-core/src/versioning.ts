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
