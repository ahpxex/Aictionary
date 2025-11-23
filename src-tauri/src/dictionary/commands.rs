use std::fs;
use tauri::{AppHandle, Manager};

use super::types::{UpsertDictionaryEntryArgs, WordDefinition};
use super::utils::resolve_cache_dir;

/// Query the dictionary for a word definition.
/// Reads from the cache directory at {cache_path}/{word}.json
#[tauri::command]
pub fn dictionary_query(word: String, cache_path: String) -> Result<WordDefinition, String> {
    let word = word.trim();
    let cache_path = cache_path.trim();

    if word.is_empty() {
        return Err("Word is required".into());
    }

    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    let file_path = cache_dir.join(format!("{}.json", word.to_lowercase()));

    if !file_path.exists() {
        return Err(format!("Word '{}' not found in dictionary", word));
    }

    let content = fs::read_to_string(&file_path)
        .map_err(|err| format!("Failed to read dictionary file: {}", err))?;

    let definition: WordDefinition = serde_json::from_str(&content)
        .map_err(|err| format!("Failed to parse dictionary data: {}", err))?;

    Ok(definition)
}

/// Insert or update a dictionary entry in the cache.
/// Writes to {cache_path}/{word}.json
#[tauri::command]
pub fn upsert_dictionary_entry(args: UpsertDictionaryEntryArgs) -> Result<(), String> {
    let UpsertDictionaryEntryArgs {
        cache_path,
        mut entry,
    } = args;
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

/// Get the default dictionary cache path.
/// Creates the directory if it doesn't exist.
#[tauri::command]
pub fn get_default_dictionary_path(app: AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    let dict_path = app_dir.join("dictionary");
    fs::create_dir_all(&dict_path).map_err(|err| err.to_string())?;
    Ok(dict_path.to_string_lossy().into())
}

/// Check if the dictionary cache directory exists and contains JSON files.
/// Returns true if at least one .json file is found, false otherwise.
#[tauri::command]
pub fn check_dictionary_cache_exists(cache_path: String) -> Result<bool, String> {
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Ok(false);
    }

    let cache_dir = resolve_cache_dir(cache_path).map_err(|err| err.to_string())?;

    if !cache_dir.exists() || !cache_dir.is_dir() {
        return Ok(false);
    }

    let has_json_files = fs::read_dir(&cache_dir)
        .map_err(|err| err.to_string())?
        .filter_map(|entry| entry.ok())
        .any(|entry| {
            entry
                .path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("json"))
                .unwrap_or(false)
        });

    Ok(has_json_files)
}

/// Count the number of dictionary entry files in the cache directory.
/// Returns the number of `.json` files found directly under the cache path.
#[tauri::command]
pub fn count_dictionary_entries(cache_path: String) -> Result<u64, String> {
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Ok(0);
    }

    let cache_dir = resolve_cache_dir(cache_path).map_err(|err| err.to_string())?;

    if !cache_dir.exists() || !cache_dir.is_dir() {
        return Ok(0);
    }

    let mut count: u64 = 0;

    let entries = fs::read_dir(&cache_dir).map_err(|err| err.to_string())?;
    for entry in entries {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|ext| ext.to_str()) {
                if ext.eq_ignore_ascii_case("json") {
                    count += 1;
                }
            }
        }
    }

    Ok(count)
}
