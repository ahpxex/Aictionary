import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDownload } from "@/shared/hooks/use-download";
import type { DownloadOptions } from "@/shared/types/download";

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  downloadOptions: DownloadOptions | null;
  onSuccess?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function DownloadDialog({
  open,
  onOpenChange,
  downloadOptions,
  onSuccess,
}: DownloadDialogProps) {
  const { t } = useTranslation();
  const {
    isDownloading,
    isExtracting,
    progress,
    extractProgress,
    error,
    retryAttempt,
    startDownload,
    reset,
  } = useDownload();

  useEffect(() => {
    if (open && downloadOptions) {
      startDownload({
        ...downloadOptions,
        onComplete: (result) => {
          downloadOptions.onComplete?.(result);
          if (!downloadOptions.extractAfterDownload) {
            setTimeout(() => {
              onSuccess?.();
              onOpenChange(false);
              reset();
            }, 1500);
          }
        },
        onExtractComplete: () => {
          downloadOptions.onExtractComplete?.();
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
            reset();
          }, 1500);
        },
      }).catch(() => {
        // Error is already tracked in state
      });
    }
  }, [open, downloadOptions]);

  const handleClose = () => {
    if (!isDownloading && !isExtracting) {
      onOpenChange(false);
      reset();
    }
  };

  const canClose = !isDownloading && !isExtracting;
  const showProgress = progress && progress.total > 0;

  return (
    <Dialog open={open} onOpenChange={canClose ? onOpenChange : undefined}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("download.dialog.title")}</DialogTitle>
          <DialogDescription>
            {isExtracting
              ? t("download.dialog.extracting")
              : isDownloading
              ? t("download.dialog.downloading")
              : error
              ? t("download.dialog.error")
              : t("download.dialog.complete")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <>
              {retryAttempt > 0 && (
                <div className="text-sm text-muted-foreground text-center">
                  {t("download.dialog.retry", {
                    attempt: retryAttempt,
                    maxRetries: downloadOptions?.maxRetries || 3,
                  })}
                </div>
              )}

              {isDownloading && showProgress && (
                <div className="space-y-2">
                  <Progress
                    value={Math.min(100, progress.percentage)}
                    className="h-2"
                  />
                  <div className="text-sm text-muted-foreground text-center">
                    {t("download.dialog.progress", {
                      downloaded: formatBytes(progress.downloaded),
                      total: formatBytes(progress.total),
                      percentage: Math.min(100, progress.percentage).toFixed(1),
                    })}
                  </div>
                </div>
              )}

              {isDownloading && !showProgress && (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              )}

              {isExtracting && extractProgress && (
                <div className="space-y-2">
                  <Progress
                    value={Math.min(
                      100,
                      (extractProgress.current / extractProgress.total) * 100
                    )}
                    className="h-2"
                  />
                  <div className="text-sm text-muted-foreground text-center">
                    {Math.min(
                      100,
                      Math.round(
                        (extractProgress.current / extractProgress.total) * 100
                      )
                    )}
                    %
                  </div>
                </div>
              )}

              {!isDownloading && !isExtracting && !error && (
                <div className="text-center text-sm font-medium text-green-600 dark:text-green-500">
                  {t("download.dialog.complete")}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleClose} disabled={!canClose} variant="outline">
            {t("download.dialog.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
