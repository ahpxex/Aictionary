//! Corpus frequency is separate from both dictionary entries and lookup history.
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde::Serialize;
use std::{fs, io::Read, path::Path, sync::Mutex};
use tauri::Manager;

const DATA: &[u8] = include_bytes!("../data/wordfreq-en-3.1.1.sqlite.gz");
const FILE: &str = "wordfreq-en-3.1.1.sqlite";
static EXTRACTION: Mutex<()> = Mutex::new(());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordFrequency {
    zipf: f64,
    per_million: f64,
}

fn query(dir: &Path, word: &str, language: &str) -> Result<Option<WordFrequency>, String> {
    if language != "en" {
        return Ok(None);
    }
    let word = word.trim().to_ascii_lowercase();
    if word.is_empty() {
        return Ok(None);
    }
    let path = dir.join(FILE);
    {
        let _guard = EXTRACTION.lock().map_err(|e| e.to_string())?;
        if !path.is_file() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
            let mut bytes = Vec::new();
            flate2::read::GzDecoder::new(DATA)
                .read_to_end(&mut bytes)
                .map_err(|e| e.to_string())?;
            let partial = path.with_extension("part");
            fs::write(&partial, bytes).map_err(|e| e.to_string())?;
            fs::rename(partial, &path).map_err(|e| e.to_string())?;
        }
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| e.to_string())?;
    let zipf: Option<f64> = conn
        .query_row(
            "SELECT zipf FROM frequencies WHERE word = ?1",
            [word],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(zipf.map(|zipf| WordFrequency {
        zipf,
        per_million: 10_f64.powf(zipf - 3.0),
    }))
}

#[tauri::command]
pub async fn word_frequency(
    app: tauri::AppHandle,
    word: String,
    language: String,
) -> Result<Option<WordFrequency>, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("word-frequency");
    tauri::async_runtime::spawn_blocking(move || query(&dir, &word, &language))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bundled_corpus_distinguishes_common_rare_and_unknown_words() {
        let dir = tempfile::tempdir().unwrap();
        let common = query(dir.path(), " THE ", "en").unwrap().unwrap();
        let rare = query(dir.path(), "serendipity", "en").unwrap().unwrap();
        assert_eq!(common.zipf, 7.73);
        assert!(common.zipf > rare.zipf);
        assert!(query(dir.path(), "zzqnonexistentzzq", "en")
            .unwrap()
            .is_none());
        assert!(query(dir.path(), "the", "de").unwrap().is_none());
        assert!(query(dir.path(), "the cat", "en").unwrap().is_none());
        let conn = Connection::open(dir.path().join(FILE)).unwrap();
        let notices: String = conn
            .query_row(
                "SELECT value FROM metadata WHERE key='upstream_notices'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(notices.contains("SUBTLEX"));
    }
}
