import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  DownloadOptions,
  DownloadComplete,
  DownloadProgress,
  DownloadError,
  DownloadRetry,
  ExtractProgress,
} from "@/shared/types/download";

export async function downloadFile(
  options: DownloadOptions
): Promise<DownloadComplete> {
  const { url, filePath, maxRetries = 3 } = options;

  const unlistenProgress = await listen<DownloadProgress>(
    "download-progress",
    (event) => {
      options.onProgress?.(event.payload);
    }
  );

  const unlistenComplete = await listen<DownloadComplete>(
    "download-complete",
    (event) => {
      options.onComplete?.(event.payload);
    }
  );

  const unlistenError = await listen<DownloadError>("download-error", (event) => {
    options.onError?.(event.payload);
  });

  const unlistenRetry = await listen<DownloadRetry>("download-retry", (event) => {
    options.onRetry?.(event.payload);
  });

  let unlistenVerifyProgress: (() => void) | null = null;
  let unlistenExtractProgress: (() => void) | null = null;
  let unlistenExtractComplete: (() => void) | null = null;

  if (options.gunzip) {
    unlistenVerifyProgress = await listen<ExtractProgress>(
      "verify-progress",
      (event) => {
        options.onVerifyProgress?.(event.payload);
      }
    );

    unlistenExtractProgress = await listen<ExtractProgress>(
      "extract-progress",
      (event) => {
        options.onExtractProgress?.(event.payload);
      }
    );

    unlistenExtractComplete = await listen("extract-complete", () => {
      options.onExtractComplete?.();
    });
  }

  try {
    const result = await invoke<DownloadComplete>("download_file", {
      args: {
        url,
        filePath,
        maxRetries,
      },
    });

    if (options.gunzip) {
      await invoke<string>("extract_gzip", {
        args: {
          gzipPath: result.filePath,
          destPath: options.gunzip.destPath,
          expectedSha256: options.gunzip.expectedSha256 ?? null,
        },
      });
    }

    return result;
  } finally {
    unlistenProgress();
    unlistenComplete();
    unlistenError();
    unlistenRetry();
    unlistenVerifyProgress?.();
    unlistenExtractProgress?.();
    unlistenExtractComplete?.();
  }
}

/**
 * Fetch a text file (e.g. SHA256SUMS.txt) through the Rust backend so
 * release-asset downloads never depend on webview CORS policies.
 */
export async function fetchTextFile(url: string): Promise<string> {
  return invoke<string>("fetch_text_file", { url });
}
