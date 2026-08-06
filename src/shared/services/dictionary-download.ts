import {
  getLatestDictionaryRelease,
  DICTIONARY_ASSET_NAME,
  type DictionaryReleaseInfo,
} from "@/shared/services/github-service";
import { fetchTextFile } from "@/shared/services/download-service";
import type { DownloadOptions } from "@/shared/types/download";

export const DISTRIBUTION_DB_FILE = "distribution.sqlite";

/**
 * Parse a `sha256sum`-style manifest and return the hash recorded for the
 * given file name, or null when absent.
 */
export function parseSha256Sums(
  manifest: string,
  fileName: string
): string | null {
  for (const line of manifest.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // Format: "<hex hash>  <file name>" (one or two spaces, optional `*`).
    const match = trimmed.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (match && match[2].trim() === fileName) {
      return match[1].toLowerCase();
    }
  }

  return null;
}

function trimTrailingSlashes(path: string): string {
  return path.replace(/[\/\\]+$/, "");
}

export type DictionaryDownloadPlan = {
  release: DictionaryReleaseInfo;
  options: DownloadOptions;
};

/**
 * Build the full download plan for the latest dictionary release: the
 * gzip archive is downloaded into the cache directory, verified against the
 * release's SHA256SUMS.txt when available, and decompressed to
 * distribution.sqlite in place.
 */
export async function planDictionaryDownload(
  cachePath: string,
  callbacks?: Pick<DownloadOptions, "onComplete" | "onExtractComplete">
): Promise<DictionaryDownloadPlan> {
  const cacheDir = trimTrailingSlashes(cachePath.trim());
  if (!cacheDir) {
    throw new Error("Dictionary cache path is not configured");
  }

  const release = await getLatestDictionaryRelease();

  let expectedSha256: string | undefined;
  if (release.checksumsUrl) {
    try {
      const manifest = await fetchTextFile(release.checksumsUrl);
      expectedSha256 =
        parseSha256Sums(manifest, DICTIONARY_ASSET_NAME) ?? undefined;
    } catch (error) {
      // A missing manifest downgrades to an unverified download rather than
      // blocking the update entirely.
      console.warn("Failed to fetch dictionary checksums:", error);
    }
  }

  const options: DownloadOptions = {
    url: release.downloadUrl,
    filePath: `${cacheDir}/${DICTIONARY_ASSET_NAME}`,
    maxRetries: 3,
    gunzip: {
      destPath: `${cacheDir}/${DISTRIBUTION_DB_FILE}`,
      expectedSha256,
    },
    ...callbacks,
  };

  return { release, options };
}
