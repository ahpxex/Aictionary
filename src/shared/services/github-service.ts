interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  assets: GitHubAsset[];
}

export interface DictionaryReleaseInfo {
  version: string;
  downloadUrl: string;
  fileName: string;
  /** Size in bytes of the compressed archive. */
  size: number;
  publishedAt: string;
  /** Download URL of the release's SHA256SUMS.txt, when published. */
  checksumsUrl: string | null;
}

const GITHUB_REPO_OWNER = "ahpxex";
const GITHUB_REPO_NAME = "open-dictionary";
/** The app's own repository, where its releases are published. */
const APP_REPO_NAME = "Aictionary";

export interface AppReleaseInfo {
  /** The tag verbatim, e.g. "v3.1.0". */
  tag: string;
  /** Human-readable release title. */
  name: string;
  publishedAt: string;
  /** The release page, for sending the user somewhere they can download it. */
  htmlUrl: string;
}

/**
 * Fetch the latest published release of the app itself.
 *
 * This only reports what is available; nothing is downloaded or installed.
 * GitHub's "latest" endpoint already skips drafts and pre-releases.
 */
export async function getLatestAppRelease(): Promise<AppReleaseInfo> {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${APP_REPO_NAME}/releases/latest`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest app release: ${response.status} ${response.statusText}`
    );
  }

  const release: GitHubRelease = await response.json();

  return {
    tag: release.tag_name,
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
  };
}

/**
 * Release asset names of the open-dictionary v2.0 distribution contract.
 * The dictionary ships as a gzip-compressed SQLite artifact plus a checksum
 * manifest.
 */
export const DICTIONARY_ASSET_NAME = "distribution.sqlite.gz";
export const CHECKSUMS_ASSET_NAME = "SHA256SUMS.txt";

function toDictionaryReleaseInfo(
  release: GitHubRelease
): DictionaryReleaseInfo | null {
  const asset = release.assets.find(
    (asset) => asset.name === DICTIONARY_ASSET_NAME
  );

  if (!asset) {
    return null;
  }

  const checksums = release.assets.find(
    (asset) => asset.name === CHECKSUMS_ASSET_NAME
  );

  return {
    version: release.tag_name,
    downloadUrl: asset.browser_download_url,
    fileName: asset.name,
    size: asset.size,
    publishedAt: release.published_at,
    checksumsUrl: checksums?.browser_download_url ?? null,
  };
}

/**
 * Fetches the latest release information from the GitHub repository
 */
export async function getLatestDictionaryRelease(): Promise<DictionaryReleaseInfo> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch latest release: ${response.status} ${response.statusText}`
      );
    }

    const release: GitHubRelease = await response.json();
    const info = toDictionaryReleaseInfo(release);

    if (!info) {
      throw new Error(
        `Asset '${DICTIONARY_ASSET_NAME}' not found in the latest release`
      );
    }

    return info;
  } catch (error) {
    console.error("Error fetching dictionary release:", error);
    throw error;
  }
}

/**
 * Fetches all releases from the GitHub repository
 */
export async function getAllDictionaryReleases(): Promise<
  DictionaryReleaseInfo[]
> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch releases: ${response.status} ${response.statusText}`
      );
    }

    const releases: GitHubRelease[] = await response.json();

    // Map releases to dictionary release info, filtering out releases
    // published before the SQLite distribution contract.
    return releases
      .map(toDictionaryReleaseInfo)
      .filter((info): info is DictionaryReleaseInfo => info !== null);
  } catch (error) {
    console.error("Error fetching dictionary releases:", error);
    throw error;
  }
}
