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

/** Verification / extraction progress in bytes of the compressed archive. */
export interface ExtractProgress {
  current: number;
  total: number;
  fileName: string;
}

export interface GunzipOptions {
  /** Final path of the decompressed file. */
  destPath: string;
  /** Lowercase hex SHA-256 of the gzip archive; verified before extraction. */
  expectedSha256?: string;
}

export interface DownloadOptions {
  url: string;
  filePath: string;
  maxRetries?: number;
  onProgress?: (progress: DownloadProgress) => void;
  onComplete?: (result: DownloadComplete) => void;
  onError?: (error: DownloadError) => void;
  onRetry?: (retry: DownloadRetry) => void;
  /** When set, the downloaded gzip archive is verified and decompressed. */
  gunzip?: GunzipOptions;
  onVerifyProgress?: (progress: ExtractProgress) => void;
  onExtractProgress?: (progress: ExtractProgress) => void;
  onExtractComplete?: () => void;
}

export interface DownloadState {
  isDownloading: boolean;
  isVerifying: boolean;
  isExtracting: boolean;
  progress: DownloadProgress | null;
  extractProgress: ExtractProgress | null;
  error: string | null;
  retryAttempt: number;
}
