use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadComplete {
    pub file_path: String,
    pub total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadError {
    pub message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadArgs {
    pub url: String,
    pub file_path: String,
    pub max_retries: Option<u32>,
}

async fn download_with_progress(
    app: AppHandle,
    url: &str,
    dest_path: &Path,
    max_retries: u32,
) -> Result<u64, String> {
    let mut attempt = 0;
    let mut last_error = String::new();

    while attempt <= max_retries {
        if attempt > 0 {
            app.emit(
                "download-retry",
                serde_json::json!({
                    "attempt": attempt,
                    "maxRetries": max_retries
                }),
            )
            .ok();
        }

        match try_download(&app, url, dest_path).await {
            Ok(total_bytes) => return Ok(total_bytes),
            Err(err) => {
                last_error = err;
                attempt += 1;
                if attempt <= max_retries {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2_u64.pow(attempt - 1)))
                        .await;
                }
            }
        }
    }

    Err(format!(
        "Download failed after {} attempts: {}",
        max_retries + 1,
        last_error
    ))
}

async fn try_download(app: &AppHandle, url: &str, dest_path: &Path) -> Result<u64, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);

    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let mut file = File::create(dest_path).map_err(|e| format!("Failed to create file: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_progress_emit = 0u64;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Failed to read chunk: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Failed to write chunk: {}", e))?;

        downloaded += chunk.len() as u64;

        let percentage = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        // Emit progress every 100KB or when we reach/exceed the total
        if downloaded - last_progress_emit >= 1024 * 100 || downloaded >= total_size {
            app.emit(
                "download-progress",
                DownloadProgress {
                    downloaded,
                    total: total_size,
                    percentage,
                },
            )
            .ok();
            last_progress_emit = downloaded;
        }
    }

    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    // Emit final 100% progress
    if total_size > 0 {
        app.emit(
            "download-progress",
            DownloadProgress {
                downloaded,
                total: downloaded.max(total_size), // Use actual downloaded size
                percentage: 100.0,
            },
        )
        .ok();
    }

    Ok(downloaded)
}

#[tauri::command]
pub async fn download_file(app: AppHandle, args: DownloadArgs) -> Result<DownloadComplete, String> {
    if args.url.trim().is_empty() {
        return Err("URL is required".into());
    }

    if args.file_path.trim().is_empty() {
        return Err("File path is required".into());
    }

    let max_retries = args.max_retries.unwrap_or(3);
    let dest_path = PathBuf::from(&args.file_path);

    app.emit("download-start", serde_json::json!({ "url": args.url }))
        .ok();

    match download_with_progress(app.clone(), &args.url, &dest_path, max_retries).await {
        Ok(total_bytes) => {
            let result = DownloadComplete {
                file_path: args.file_path.clone(),
                total_bytes,
            };
            app.emit("download-complete", result.clone()).ok();
            Ok(result)
        }
        Err(err) => {
            app.emit(
                "download-error",
                DownloadError {
                    message: err.clone(),
                },
            )
            .ok();
            Err(err)
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractGzipArgs {
    pub gzip_path: String,
    pub dest_path: String,
    /// Lowercase hex SHA-256 of the gzip file, taken from the release's
    /// SHA256SUMS.txt. When present, the archive is verified before
    /// extraction and rejected on mismatch.
    pub expected_sha256: Option<String>,
}

/// Progress for verification and extraction, measured in bytes of the
/// compressed archive consumed so far.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractProgress {
    pub current: u64,
    pub total: u64,
    pub file_name: String,
}

const PROGRESS_CHUNK: u64 = 4 * 1024 * 1024;

fn compute_sha256(app: &AppHandle, path: &Path, total: u64) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|e| format!("Failed to open archive for verification: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut read_total: u64 = 0;
    let mut last_emit: u64 = 0;

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("Failed to read archive for verification: {}", e))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        read_total += read as u64;

        if read_total - last_emit >= PROGRESS_CHUNK || read_total >= total {
            app.emit(
                "verify-progress",
                ExtractProgress {
                    current: read_total,
                    total,
                    file_name: path
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                },
            )
            .ok();
            last_emit = read_total;
        }
    }

    let digest = hasher.finalize();
    Ok(digest.iter().map(|b| format!("{:02x}", b)).collect())
}

fn gunzip_with_progress(
    app: &AppHandle,
    gzip_path: &Path,
    dest_path: &Path,
    total: u64,
) -> Result<(), String> {
    struct CountingReader<R: Read> {
        inner: R,
        read: std::rc::Rc<std::cell::Cell<u64>>,
    }

    impl<R: Read> Read for CountingReader<R> {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            let read = self.inner.read(buf)?;
            self.read.set(self.read.get() + read as u64);
            Ok(read)
        }
    }

    let file = File::open(gzip_path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let compressed_read = std::rc::Rc::new(std::cell::Cell::new(0u64));
    let counting = CountingReader {
        inner: std::io::BufReader::new(file),
        read: compressed_read.clone(),
    };
    let mut decoder = GzDecoder::new(counting);

    if let Some(parent) = dest_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create extraction directory: {}", e))?;
    }

    // Decompress into a temporary sibling first so an interrupted run never
    // leaves a truncated database at the final path.
    let partial_path = dest_path.with_extension("sqlite.part");
    let mut out =
        File::create(&partial_path).map_err(|e| format!("Failed to create output file: {}", e))?;

    let file_name = dest_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut buffer = vec![0u8; 1024 * 1024];
    let mut last_emit: u64 = 0;

    let result: Result<(), String> = loop {
        let read = match decoder.read(&mut buffer) {
            Ok(read) => read,
            Err(e) => break Err(format!("Failed to decompress archive: {}", e)),
        };
        if read == 0 {
            break Ok(());
        }
        if let Err(e) = out.write_all(&buffer[..read]) {
            break Err(format!("Failed to write extracted data: {}", e));
        }

        let current = compressed_read.get();
        if current - last_emit >= PROGRESS_CHUNK {
            app.emit(
                "extract-progress",
                ExtractProgress {
                    current,
                    total,
                    file_name: file_name.clone(),
                },
            )
            .ok();
            last_emit = current;
        }
    };

    if let Err(err) = result {
        drop(out);
        fs::remove_file(&partial_path).ok();
        return Err(err);
    }

    out.flush()
        .map_err(|e| format!("Failed to flush extracted data: {}", e))?;
    drop(out);

    fs::rename(&partial_path, dest_path)
        .map_err(|e| format!("Failed to move extracted file into place: {}", e))?;

    app.emit(
        "extract-progress",
        ExtractProgress {
            current: total,
            total,
            file_name,
        },
    )
    .ok();

    Ok(())
}

/// Verify (optionally) and decompress a downloaded gzip archive, then
/// delete the archive on success. Used for the dictionary's
/// distribution.sqlite.gz release asset.
#[tauri::command]
pub async fn extract_gzip(app: AppHandle, args: ExtractGzipArgs) -> Result<String, String> {
    let gzip_path = PathBuf::from(&args.gzip_path);
    let dest_path = PathBuf::from(&args.dest_path);

    if !gzip_path.is_file() {
        return Err("Archive file does not exist".into());
    }

    let total = fs::metadata(&gzip_path).map(|meta| meta.len()).unwrap_or(0);

    app.emit("extract-start", serde_json::json!({ "totalBytes": total }))
        .ok();

    let expected = args
        .expected_sha256
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_lowercase);

    let result = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        if let Some(expected) = expected {
            let actual = compute_sha256(&app, &gzip_path, total)?;
            if actual != expected {
                return Err(format!(
                    "Checksum mismatch for downloaded dictionary: expected {}, got {}",
                    expected, actual
                ));
            }
        }

        gunzip_with_progress(&app, &gzip_path, &dest_path, total)?;
        fs::remove_file(&gzip_path).ok();

        app.emit("extract-complete", serde_json::json!({})).ok();

        Ok(dest_path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| format!("Extraction task failed: {}", e))?;

    result
}

/// Fetch a small text file (e.g. a release's SHA256SUMS.txt) over HTTP.
/// Runs in Rust so release-asset downloads never depend on webview CORS.
#[tauri::command]
pub async fn fetch_text_file(url: String) -> Result<String, String> {
    let url = url.trim().to_string();
    if url.is_empty() {
        return Err("URL is required".into());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch {}: {}", url, e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))
}
