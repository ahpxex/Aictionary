/**
 * Release tags are compared numerically segment by segment. The repository's
 * history contains tags that predate any convention ("re", "1.1"), so parsing
 * has to fail closed: anything that is not a dotted number sequence is
 * treated as "cannot be newer" rather than guessed at.
 */

/** Strip a leading `v` and any pre-release/build suffix, then split. */
function parseVersion(value: string): number[] | null {
  const match = /^v?(\d+(?:\.\d+)*)/.exec(value.trim());
  if (!match) {
    return null;
  }
  return match[1].split(".").map((part) => Number.parseInt(part, 10));
}

/**
 * Compare two version strings. Returns a positive number when `a` is newer,
 * negative when `b` is, and 0 when they are equal or either is unparseable.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) {
    return 0;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    // A missing segment reads as 0, so "3.0" and "3.0.0" are the same release.
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

/** Whether `candidate` names a release strictly newer than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
