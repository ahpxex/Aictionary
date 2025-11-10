import { useState, useCallback, useRef } from "react";
import { downloadFile } from "@/shared/services/download-service";
import type {
  DownloadOptions,
  DownloadState,
  DownloadProgress,
  DownloadComplete,
  DownloadError,
  DownloadRetry,
  ExtractProgress,
} from "@/shared/types/download";

export function useDownload() {
  const [state, setState] = useState<DownloadState>({
    isDownloading: false,
    isExtracting: false,
    progress: null,
    extractProgress: null,
    error: null,
    retryAttempt: 0,
  });

  const downloadPromiseRef = useRef<Promise<DownloadComplete> | null>(null);

  const handleProgress = useCallback((progress: DownloadProgress) => {
    setState((prev) => ({
      ...prev,
      progress,
      error: null,
    }));
  }, []);

  const handleComplete = useCallback((_result: DownloadComplete) => {
    setState((prev) => ({
      ...prev,
      isDownloading: false,
      error: null,
    }));
  }, []);

  const handleError = useCallback((error: DownloadError) => {
    setState((prev) => ({
      ...prev,
      isDownloading: false,
      isExtracting: false,
      error: error.message,
    }));
  }, []);

  const handleRetry = useCallback((retry: DownloadRetry) => {
    setState((prev) => ({
      ...prev,
      retryAttempt: retry.attempt,
    }));
  }, []);

  const handleExtractProgress = useCallback((progress: ExtractProgress) => {
    setState((prev) => ({
      ...prev,
      isExtracting: true,
      extractProgress: progress,
    }));
  }, []);

  const handleExtractComplete = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isExtracting: false,
      extractProgress: null,
    }));
  }, []);

  const startDownload = useCallback(
    async (options: DownloadOptions): Promise<DownloadComplete> => {
      setState({
        isDownloading: true,
        isExtracting: false,
        progress: null,
        extractProgress: null,
        error: null,
        retryAttempt: 0,
      });

      const promise = downloadFile({
        ...options,
        onProgress: (progress) => {
          handleProgress(progress);
          options.onProgress?.(progress);
        },
        onComplete: (result) => {
          handleComplete(result);
          options.onComplete?.(result);
        },
        onError: (error) => {
          handleError(error);
          options.onError?.(error);
        },
        onRetry: (retry) => {
          handleRetry(retry);
          options.onRetry?.(retry);
        },
        onExtractProgress: (progress) => {
          handleExtractProgress(progress);
          options.onExtractProgress?.(progress);
        },
        onExtractComplete: () => {
          handleExtractComplete();
          options.onExtractComplete?.();
        },
      });

      downloadPromiseRef.current = promise;

      try {
        return await promise;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          isDownloading: false,
          isExtracting: false,
          error: message,
        }));
        throw error;
      }
    },
    [
      handleProgress,
      handleComplete,
      handleError,
      handleRetry,
      handleExtractProgress,
      handleExtractComplete,
    ]
  );

  const reset = useCallback(() => {
    setState({
      isDownloading: false,
      isExtracting: false,
      progress: null,
      extractProgress: null,
      error: null,
      retryAttempt: 0,
    });
  }, []);

  return {
    ...state,
    startDownload,
    reset,
  };
}
