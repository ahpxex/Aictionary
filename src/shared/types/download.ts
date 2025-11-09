export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface DownloadComplete {
  filePath: string;
  totalBytes: number;
}

export interface DownloadError {
  message: string;
}

export interface DownloadRetry {
  attempt: number;
  maxRetries: number;
}

export interface ExtractProgress {
  current: number;
  total: number;
  fileName: string;
}

export interface DownloadOptions {
  url: string;
  filePath: string;
  maxRetries?: number;
  onProgress?: (progress: DownloadProgress) => void;
  onComplete?: (result: DownloadComplete) => void;
  onError?: (error: DownloadError) => void;
  onRetry?: (retry: DownloadRetry) => void;
  extractAfterDownload?: boolean;
  extractTo?: string;
  onExtractProgress?: (progress: ExtractProgress) => void;
  onExtractComplete?: () => void;
}

export interface DownloadState {
  isDownloading: boolean;
  isExtracting: boolean;
  progress: DownloadProgress | null;
  extractProgress: ExtractProgress | null;
  error: string | null;
  retryAttempt: number;
}
