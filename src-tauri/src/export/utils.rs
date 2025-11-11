use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Write content to a file in the user's Downloads directory.
/// Returns the absolute path to the created file.
pub fn write_to_downloads(
    app: &AppHandle,
    filename: &str,
    content: String,
) -> Result<PathBuf, String> {
    let download_dir = app.path().download_dir().map_err(|err| err.to_string())?;
    let file_path = download_dir.join(filename);
    fs::write(&file_path, content).map_err(|err| err.to_string())?;
    Ok(file_path)
}
