/**
 * Example usage of the download service with dialog
 *
 * This file demonstrates how to use the download service to download
 * and extract files with progress feedback.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DownloadDialog } from "@/shared/components/download-dialog";
import { getLatestDictionaryRelease } from "@/shared/services/github-service";
import type { DownloadOptions } from "@/shared/types/download";

export function DownloadExample() {
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions | null>(
    null
  );

  const handleDownloadDictionary = async () => {
    try {
      // Get the latest release info from GitHub
      const release = await getLatestDictionaryRelease();

      // Prepare download options
      const options: DownloadOptions = {
        url: release.downloadUrl,
        filePath: `/tmp/open-english-dictionary.zip`, // Or use path from settings
        maxRetries: 3,
        extractAfterDownload: true,
        extractTo: `/tmp/dictionary`, // Or use path from settings
        onComplete: (result) => {
          console.log("Download complete:", result);
        },
        onExtractComplete: () => {
          console.log("Extraction complete!");
        },
      };

      // Set options and open dialog
      setDownloadOptions(options);
      setDownloadDialogOpen(true);
    } catch (error) {
      console.error("Failed to get dictionary release:", error);
    }
  };

  return (
    <>
      <Button onClick={handleDownloadDictionary}>
        Download Dictionary
      </Button>

      <DownloadDialog
        open={downloadDialogOpen}
        onOpenChange={setDownloadDialogOpen}
        downloadOptions={downloadOptions}
        onSuccess={() => {
          console.log("All done!");
        }}
      />
    </>
  );
}
