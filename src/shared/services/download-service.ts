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

  let unlistenExtractProgress: (() => void) | null = null;
  let unlistenExtractComplete: (() => void) | null = null;

  if (options.extractAfterDownload && options.extractTo) {
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

    if (options.extractAfterDownload && options.extractTo) {
      await invoke<string>("extract_zip", {
        args: {
          zipPath: result.filePath,
          extractTo: options.extractTo,
        },
      });
    }

    return result;
  } finally {
    unlistenProgress();
    unlistenComplete();
    unlistenError();
    unlistenRetry();
    unlistenExtractProgress?.();
    unlistenExtractComplete?.();
  }
}

export async function extractZip(
  zipPath: string,
  extractTo: string,
  onProgress?: (progress: ExtractProgress) => void,
  onComplete?: () => void
): Promise<string> {
  const unlistenProgress = await listen<ExtractProgress>(
    "extract-progress",
    (event) => {
      onProgress?.(event.payload);
    }
  );

  const unlistenComplete = await listen("extract-complete", () => {
    onComplete?.();
  });

  try {
    const result = await invoke<string>("extract_zip", {
      args: {
        zipPath,
        extractTo,
      },
    });

    return result;
  } finally {
    unlistenProgress();
    unlistenComplete();
  }
}
