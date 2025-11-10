use serde::{Deserialize, Serialize, Deserializer};
use tauri::Manager;
use std::fs;
use std::path::PathBuf;
use std::collections::BTreeMap;
use serde_json::Value;

mod download;

#[derive(Serialize, Deserialize, Clone)]
struct DefinitionEntry {
    pos: String,
    explanation_en: String,
    explanation_cn: String,
    example_en: String,
    example_cn: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ComparisonEntry {
    #[serde(default)]
    word_to_compare: String,
    #[serde(default)]
    analysis: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct WordDefinition {
    word: String,
    pronunciation: String,
    concise_definition: String,
    #[serde(default, deserialize_with = "deserialize_forms")]
    forms: BTreeMap<String, String>,
    #[serde(default)]
    definitions: Vec<DefinitionEntry>,
    #[serde(default)]
    comparison: Vec<ComparisonEntry>,
}

fn deserialize_forms<'de, D>(deserializer: D) -> Result<BTreeMap<String, String>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw = Option::<BTreeMap<String, Value>>::deserialize(deserializer)?
        .unwrap_or_default();

    Ok(raw
        .into_iter()
        .map(|(key, value)| (key, value_to_string(value)))
        .collect())
}

fn value_to_string(value: Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(num) => num.to_string(),
        Value::String(s) => s,
        Value::Array(items) => items.into_iter().map(value_to_string).collect::<Vec<_>>().join(", "),
        Value::Object(_) => "[object]".into(),
    }
}

fn resolve_cache_dir(cache_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(cache_path);
    if path.is_absolute() {
        Ok(path)
    } else {
        let cwd = std::env::current_dir().map_err(|err| err.to_string())?;
        Ok(cwd.join(path))
    }
}

#[tauri::command]
fn dictionary_query(word: String, cache_path: String) -> Result<WordDefinition, String> {
    let word = word.trim();
    let cache_path = cache_path.trim();

    if word.is_empty() {
        return Err("Word is required".into());
    }

    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    // Construct the file path: {cache_path}/{word}.json
    let file_path = cache_dir.join(format!("{}.json", word.to_lowercase()));

    // Check if file exists
    if !file_path.exists() {
        return Err(format!("Word '{}' not found in dictionary", word));
    }

    // Read the file
    let content = fs::read_to_string(&file_path)
        .map_err(|err| format!("Failed to read dictionary file: {}", err))?;

    // Parse JSON
    let definition: WordDefinition = serde_json::from_str(&content)
        .map_err(|err| format!("Failed to parse dictionary data: {}", err))?;

    Ok(definition)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertDictionaryEntryArgs {
    cache_path: String,
    entry: WordDefinition,
}

#[tauri::command]
fn upsert_dictionary_entry(args: UpsertDictionaryEntryArgs) -> Result<(), String> {
    let UpsertDictionaryEntryArgs { cache_path, mut entry } = args;
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let word = entry.word.trim().to_string();
    if word.is_empty() {
        return Err("Word is required".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    fs::create_dir_all(&cache_dir)
        .map_err(|err| format!("Failed to prepare cache directory: {}", err))?;

    entry.word = word.clone();

    let payload = serde_json::to_string_pretty(&entry)
        .map_err(|err| format!("Failed to serialize dictionary entry: {}", err))?;
    let file_path = cache_dir.join(format!("{}.json", word.to_lowercase()));
    fs::write(&file_path, payload)
        .map_err(|err| format!("Failed to write dictionary entry: {}", err))?;

    Ok(())
}


#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestLlmProviderArgs {
    base_url: String,
    api_key: String,
    model: String,
}

#[tauri::command]
fn test_llm_provider(args: TestLlmProviderArgs) -> Result<(), String> {
    if args.base_url.trim().is_empty() {
        return Err("Base URL is required.".into());
    }

    if args.api_key.trim().is_empty() {
        return Err("API key is required.".into());
    }

    if args.model.trim().is_empty() {
        return Err("Model is required.".into());
    }

    // In lieu of a real call, we just simulate a connectivity check.
    Ok(())
}

#[derive(Deserialize)]
struct QueryMetricPayload {
    word: String,
    count: u32,
    #[serde(rename = "lastQueriedAt")]
    last_queried_at: String,
}

fn write_to_downloads(app: &tauri::AppHandle, filename: &str, content: String) -> Result<PathBuf, String> {
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| err.to_string())?;
    let file_path = download_dir.join(filename);
    fs::write(&file_path, content).map_err(|err| err.to_string())?;
    Ok(file_path)
}

#[tauri::command]
fn export_learned_words(app: tauri::AppHandle, words: Vec<String>) -> Result<String, String> {
    if words.is_empty() {
        return Err("No words to export.".into());
    }

    let content = words.join("\n");
    let file_path = write_to_downloads(&app, "aictionary_learned_words.txt", content)?;
    Ok(file_path.to_string_lossy().into())
}

#[tauri::command]
fn export_query_metrics(app: tauri::AppHandle, metrics: Vec<QueryMetricPayload>) -> Result<String, String> {
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

#[tauri::command]
fn get_default_dictionary_path(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?;
    let dict_path = app_dir.join("dictionary");
    fs::create_dir_all(&dict_path).map_err(|err| err.to_string())?;
    Ok(dict_path.to_string_lossy().into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            dictionary_query,
            test_llm_provider,
            export_learned_words,
            export_query_metrics,
            get_default_dictionary_path,
            download::download_file,
            download::extract_zip,
            upsert_dictionary_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
