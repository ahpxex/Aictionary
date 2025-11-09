interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GitHubAsset[];
}

export interface DictionaryReleaseInfo {
  version: string;
  downloadUrl: string;
  fileName: string;
  size: number;
  publishedAt: string;
}

const GITHUB_REPO_OWNER = "ahpxex";
const GITHUB_REPO_NAME = "open-dictionary";
const DICTIONARY_FILE_NAME = "open-english-dictionary.zip";

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

    // Find the dictionary file asset
    const asset = release.assets.find(
      (asset) => asset.name === DICTIONARY_FILE_NAME
    );

    if (!asset) {
      throw new Error(
        `Asset '${DICTIONARY_FILE_NAME}' not found in the latest release`
      );
    }

    return {
      version: release.tag_name,
      downloadUrl: asset.browser_download_url,
      fileName: asset.name,
      size: asset.size,
      publishedAt: release.published_at,
    };
  } catch (error) {
    console.error("Error fetching dictionary release:", error);
    throw error;
  }
}

/**
 * Fetches all releases from the GitHub repository
 */
export async function getAllDictionaryReleases(): Promise<DictionaryReleaseInfo[]> {
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

    // Map releases to dictionary release info, filtering out releases without the dictionary file
    return releases
      .map((release) => {
        const asset = release.assets.find(
          (asset) => asset.name === DICTIONARY_FILE_NAME
        );

        if (!asset) {
          return null;
        }

        return {
          version: release.tag_name,
          downloadUrl: asset.browser_download_url,
          fileName: asset.name,
          size: asset.size,
          publishedAt: release.published_at,
        };
      })
      .filter((info): info is DictionaryReleaseInfo => info !== null);
  } catch (error) {
    console.error("Error fetching dictionary releases:", error);
    throw error;
  }
}
