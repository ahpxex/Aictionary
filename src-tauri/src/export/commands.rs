use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use super::types::QueryMetricPayload;
use super::utils::write_to_downloads;

/// Export a list of learned words to a text file at the specified path.
/// Each word is written on a separate line.
#[tauri::command]
pub fn export_learned_words(
    app: AppHandle,
    words: Vec<String>,
    file_path: Option<String>,
) -> Result<String, String> {
    if words.is_empty() {
        return Err("No words to export.".into());
    }

    let content = words.join("\n");

    // If file_path is provided, write to that location; otherwise use downloads directory
    let output_path = if let Some(path) = file_path {
        let path_buf = PathBuf::from(&path);
        fs::write(&path_buf, content).map_err(|e| format!("Failed to write file: {}", e))?;
        path_buf
    } else {
        write_to_downloads(&app, "aictionary_learned_words.txt", content)?
    };

    Ok(output_path.to_string_lossy().into())
}

/// Export query metrics to a CSV file at the specified path.
/// CSV format: Count,Word with headers.
#[tauri::command]
pub fn export_query_metrics(
    app: AppHandle,
    metrics: Vec<QueryMetricPayload>,
    file_path: Option<String>,
) -> Result<String, String> {
    if metrics.is_empty() {
        return Err("No metrics to export.".into());
    }

    // Build CSV content with headers
    let mut content = String::from("Count,Word\n");
    for metric in metrics {
        let line = format!("{},{}\n", metric.count, metric.word);
        content.push_str(&line);
    }

    // If file_path is provided, write to that location; otherwise use downloads directory
    let output_path = if let Some(path) = file_path {
        let path_buf = PathBuf::from(&path);
        fs::write(&path_buf, content).map_err(|e| format!("Failed to write file: {}", e))?;
        path_buf
    } else {
        write_to_downloads(&app, "aictionary_query_metrics.csv", content)?
    };

    Ok(output_path.to_string_lossy().into())
}
