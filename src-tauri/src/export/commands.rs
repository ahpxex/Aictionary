use tauri::AppHandle;

use super::types::QueryMetricPayload;
use super::utils::write_to_downloads;

/// Export a list of learned words to a text file in the Downloads directory.
/// Each word is written on a separate line.
#[tauri::command]
pub fn export_learned_words(app: AppHandle, words: Vec<String>) -> Result<String, String> {
    if words.is_empty() {
        return Err("No words to export.".into());
    }

    let content = words.join("\n");
    let file_path = write_to_downloads(&app, "aictionary_learned_words.txt", content)?;
    Ok(file_path.to_string_lossy().into())
}

/// Export query metrics to a text file in the Downloads directory.
/// Each metric includes the word, query count, and last queried timestamp.
#[tauri::command]
pub fn export_query_metrics(
    app: AppHandle,
    metrics: Vec<QueryMetricPayload>,
) -> Result<String, String> {
    if metrics.is_empty() {
        return Err("No metrics to export.".into());
    }

    let mut content = String::new();
    for metric in metrics {
        let line = format!(
            "{} - {} times (last queried {})\n",
            metric.word, metric.count, metric.last_queried_at
        );
        content.push_str(&line);
    }

    let file_path = write_to_downloads(&app, "aictionary_query_metrics.txt", content)?;
    Ok(file_path.to_string_lossy().into())
}
