use rusqlite::{Connection, OpenFlags, OptionalExtension};
use serde_json::{Map, Value};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager};

use super::types::{DictionaryLookupResult, LookupSource, UpsertDictionaryEntryArgs};
use super::utils::{
    normalize_headword, resolve_cache_dir, DISTRIBUTION_DB_FILE, USER_DB_FILE,
};

fn open_read_only(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|err| format!("Failed to open dictionary database: {err}"))
}

fn parse_document(raw: &str) -> Result<Value, String> {
    serde_json::from_str(raw).map_err(|err| format!("Failed to parse dictionary entry: {err}"))
}

/// Look up an entry in the distributed dictionary artifact.
///
/// The lookup index is `(headword_language_code, normalized_headword)`, so
/// the language code must appear in the predicate. The artifact currently
/// ships a single headword language; enumerating the distinct codes keeps
/// the query index-backed without hardcoding "en".
fn query_distribution(cache_dir: &Path, normalized: &str) -> Result<Option<Value>, String> {
    let db_path = cache_dir.join(DISTRIBUTION_DB_FILE);
    if !db_path.is_file() {
        return Ok(None);
    }

    let conn = open_read_only(&db_path)?;

    let language_codes: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT DISTINCT headword_language_code FROM entries")
            .map_err(|err| format!("Failed to read dictionary database: {err}"))?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|err| format!("Failed to read dictionary database: {err}"))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|err| format!("Failed to read dictionary database: {err}"))?
    };

    let mut stmt = conn
        .prepare(
            "SELECT document_json FROM entries
             WHERE headword_language_code = ?1 AND normalized_headword = ?2
             LIMIT 1",
        )
        .map_err(|err| format!("Failed to read dictionary database: {err}"))?;

    for code in language_codes {
        let raw: Option<String> = stmt
            .query_row(rusqlite::params![code, normalized], |row| row.get(0))
            .optional()
            .map_err(|err| format!("Failed to query dictionary database: {err}"))?;
        if let Some(raw) = raw {
            return Ok(Some(parse_document(&raw)?));
        }
    }

    Ok(None)
}

fn query_user(cache_dir: &Path, normalized: &str) -> Result<Option<Value>, String> {
    let db_path = cache_dir.join(USER_DB_FILE);
    if !db_path.is_file() {
        return Ok(None);
    }

    let conn = open_read_only(&db_path)?;
    let raw: Option<String> = conn
        .query_row(
            "SELECT document_json FROM user_entries WHERE normalized_headword = ?1",
            [normalized],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| format!("Failed to query user dictionary: {err}"))?;

    match raw {
        Some(raw) => Ok(Some(parse_document(&raw)?)),
        None => Ok(None),
    }
}

fn open_user_db_rw(cache_dir: &Path) -> Result<Connection, String> {
    fs::create_dir_all(cache_dir)
        .map_err(|err| format!("Failed to prepare cache directory: {err}"))?;

    let conn = Connection::open(cache_dir.join(USER_DB_FILE))
        .map_err(|err| format!("Failed to open user dictionary: {err}"))?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS user_entries (
            normalized_headword TEXT PRIMARY KEY,
            headword TEXT NOT NULL,
            document_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
    )
    .map_err(|err| format!("Failed to initialize user dictionary: {err}"))?;

    Ok(conn)
}

/// Query the dictionary for a word.
/// Looks in {cache_path}/distribution.sqlite first, then in the user's own
/// generated entries at {cache_path}/user_dictionary.sqlite.
#[tauri::command]
pub fn dictionary_query(word: String, cache_path: String) -> Result<DictionaryLookupResult, String> {
    let word = word.trim();
    let cache_path = cache_path.trim();

    if word.is_empty() {
        return Err("Word is required".into());
    }

    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    let normalized = normalize_headword(word);

    if let Some(entry) = query_distribution(&cache_dir, &normalized)? {
        return Ok(DictionaryLookupResult {
            source: LookupSource::Dictionary,
            entry,
        });
    }

    if let Some(entry) = query_user(&cache_dir, &normalized)? {
        return Ok(DictionaryLookupResult {
            source: LookupSource::User,
            entry,
        });
    }

    Err(format!("Word '{}' not found in dictionary", word))
}

/// Insert or update a user-generated dictionary entry.
/// Writes to {cache_path}/user_dictionary.sqlite, never to the distributed
/// artifact.
#[tauri::command]
pub fn upsert_dictionary_entry(args: UpsertDictionaryEntryArgs) -> Result<(), String> {
    let UpsertDictionaryEntryArgs { cache_path, entry } = args;
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let headword = entry
        .get("headword")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default()
        .to_string();
    if headword.is_empty() {
        return Err("Entry is missing a headword".into());
    }

    let document = serde_json::to_string(&entry)
        .map_err(|err| format!("Failed to serialize dictionary entry: {err}"))?;

    let cache_dir = resolve_cache_dir(cache_path)?;
    let conn = open_user_db_rw(&cache_dir)?;

    conn.execute(
        "INSERT INTO user_entries (normalized_headword, headword, document_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(normalized_headword) DO UPDATE SET
            headword = excluded.headword,
            document_json = excluded.document_json,
            updated_at = excluded.updated_at",
        rusqlite::params![normalize_headword(&headword), headword, document],
    )
    .map_err(|err| format!("Failed to write dictionary entry: {err}"))?;

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

/// Check whether a usable dictionary database exists at the cache path.
/// A missing, unreadable, or empty database all count as "not present" so
/// the frontend can offer a (re-)download.
#[tauri::command]
pub fn check_dictionary_cache_exists(cache_path: String) -> Result<bool, String> {
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Ok(false);
    }

    let cache_dir = match resolve_cache_dir(cache_path) {
        Ok(dir) => dir,
        Err(_) => return Ok(false),
    };

    let db_path = cache_dir.join(DISTRIBUTION_DB_FILE);
    if !db_path.is_file() {
        return Ok(false);
    }

    let conn = match open_read_only(&db_path) {
        Ok(conn) => conn,
        Err(_) => return Ok(false),
    };

    let has_entries: Result<bool, _> = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM entries LIMIT 1)",
        [],
        |row| row.get(0),
    );

    Ok(has_entries.unwrap_or(false))
}

/// Count the entries in the distributed dictionary database.
/// Returns 0 when the database is missing or unreadable, mirroring the
/// "cache not present" semantics of check_dictionary_cache_exists.
#[tauri::command]
pub fn count_dictionary_entries(cache_path: String) -> Result<u64, String> {
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Ok(0);
    }

    let cache_dir = match resolve_cache_dir(cache_path) {
        Ok(dir) => dir,
        Err(_) => return Ok(0),
    };

    let db_path = cache_dir.join(DISTRIBUTION_DB_FILE);
    if !db_path.is_file() {
        return Ok(0);
    }

    let conn = match open_read_only(&db_path) {
        Ok(conn) => conn,
        Err(_) => return Ok(0),
    };

    let count: Result<u64, _> = conn.query_row("SELECT count(*) FROM entries", [], |row| row.get(0));
    Ok(count.unwrap_or(0))
}

/// Read the artifact metadata embedded in the distribution database, plus
/// the current user entry count. Gives the settings UI an authoritative
/// view of which dictionary build is installed.
#[tauri::command]
pub fn dictionary_metadata(cache_path: String) -> Result<Value, String> {
    let cache_path = cache_path.trim();
    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    let db_path = cache_dir.join(DISTRIBUTION_DB_FILE);
    if !db_path.is_file() {
        return Err("Dictionary database not found".into());
    }

    let conn = open_read_only(&db_path)?;
    let mut stmt = conn
        .prepare("SELECT key, value_json FROM metadata")
        .map_err(|err| format!("Failed to read dictionary metadata: {err}"))?;

    let mut metadata = Map::new();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|err| format!("Failed to read dictionary metadata: {err}"))?;

    for row in rows {
        let (key, value_json) =
            row.map_err(|err| format!("Failed to read dictionary metadata: {err}"))?;
        let value = serde_json::from_str(&value_json).unwrap_or(Value::String(value_json));
        metadata.insert(key, value);
    }

    let user_entry_count: u64 = match query_user_count(&cache_dir) {
        Ok(count) => count,
        Err(_) => 0,
    };
    metadata.insert("user_entry_count".into(), Value::from(user_entry_count));

    Ok(Value::Object(metadata))
}

fn query_user_count(cache_dir: &Path) -> Result<u64, String> {
    let db_path = cache_dir.join(USER_DB_FILE);
    if !db_path.is_file() {
        return Ok(0);
    }
    let conn = open_read_only(&db_path)?;
    conn.query_row("SELECT count(*) FROM user_entries", [], |row| row.get(0))
        .map_err(|err| format!("Failed to count user entries: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// Build a minimal distribution.sqlite matching the
    /// `distribution_sqlite_v1` packaging schema (the subset this module
    /// reads: `entries` with its lookup index, plus `metadata`).
    fn create_distribution_fixture(cache_dir: &Path) {
        let conn = Connection::open(cache_dir.join(DISTRIBUTION_DB_FILE)).unwrap();
        conn.execute_batch(
            "CREATE TABLE metadata (key TEXT PRIMARY KEY, value_json TEXT NOT NULL);
             CREATE TABLE entries (
                entry_id TEXT PRIMARY KEY,
                schema_version TEXT NOT NULL,
                headword TEXT NOT NULL,
                normalized_headword TEXT NOT NULL,
                headword_language_code TEXT NOT NULL,
                headword_language_name TEXT NOT NULL,
                definition_language_code TEXT NOT NULL,
                definition_language_name TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                headword_summary TEXT NOT NULL,
                memory_hook TEXT NOT NULL,
                etymology_note TEXT,
                study_notes_json TEXT NOT NULL,
                document_json TEXT NOT NULL
             );
             CREATE INDEX entries_lookup_idx
                ON entries (headword_language_code, normalized_headword);",
        )
        .unwrap();

        conn.execute(
            "INSERT INTO metadata (key, value_json) VALUES
                ('entry_count', '2'),
                ('distribution_schema_version', '\"distribution_entry_v5\"')",
            [],
        )
        .unwrap();

        for (headword, normalized) in [("resolve", "resolve"), ("China", "china")] {
            let document = json!({
                "schema_version": "distribution_entry_v5",
                "entry_id": format!("test-{normalized}"),
                "headword": headword,
                "normalized_headword": normalized,
                "pos_groups": [],
            });
            conn.execute(
                "INSERT INTO entries VALUES (?1, 'distribution_entry_v5', ?2, ?3, 'en',
                    'English', 'zh-Hans', 'Chinese (Simplified)', 'standard', '', '', NULL,
                    '[]', ?4)",
                rusqlite::params![
                    format!("test-{normalized}"),
                    headword,
                    normalized,
                    document.to_string()
                ],
            )
            .unwrap();
        }
    }

    fn cache_path(dir: &tempfile::TempDir) -> String {
        dir.path().to_string_lossy().into_owned()
    }

    #[test]
    fn query_hits_distribution_entry_case_insensitively() {
        let dir = tempfile::tempdir().unwrap();
        create_distribution_fixture(dir.path());

        let result = dictionary_query("CHINA".into(), cache_path(&dir)).unwrap();
        assert!(matches!(result.source, LookupSource::Dictionary));
        assert_eq!(result.entry["headword"], "China");
    }

    #[test]
    fn query_misses_return_not_found_error() {
        let dir = tempfile::tempdir().unwrap();
        create_distribution_fixture(dir.path());

        let error = dictionary_query("nonexistent".into(), cache_path(&dir)).unwrap_err();
        assert!(error.contains("not found"));
    }

    #[test]
    fn upsert_then_query_returns_user_entry() {
        let dir = tempfile::tempdir().unwrap();
        create_distribution_fixture(dir.path());

        let entry = json!({
            "schema_version": "distribution_entry_v5",
            "entry_id": "user-serendipity",
            "headword": "Serendipity",
            "normalized_headword": "serendipity",
            "pos_groups": [],
        });
        upsert_dictionary_entry(UpsertDictionaryEntryArgs {
            cache_path: cache_path(&dir),
            entry: entry.clone(),
        })
        .unwrap();

        let result = dictionary_query("serendipity".into(), cache_path(&dir)).unwrap();
        assert!(matches!(result.source, LookupSource::User));
        assert_eq!(result.entry["headword"], "Serendipity");

        // Distribution entries win over user entries for the same headword.
        let distribution = dictionary_query("resolve".into(), cache_path(&dir)).unwrap();
        assert!(matches!(distribution.source, LookupSource::Dictionary));
    }

    #[test]
    fn upsert_replaces_existing_user_entry() {
        let dir = tempfile::tempdir().unwrap();

        for summary in ["first", "second"] {
            upsert_dictionary_entry(UpsertDictionaryEntryArgs {
                cache_path: cache_path(&dir),
                entry: json!({ "headword": "widget", "headword_summary": summary }),
            })
            .unwrap();
        }

        let result = dictionary_query("widget".into(), cache_path(&dir)).unwrap();
        assert_eq!(result.entry["headword_summary"], "second");
        assert_eq!(query_user_count(dir.path()).unwrap(), 1);
    }

    #[test]
    fn upsert_rejects_entry_without_headword() {
        let dir = tempfile::tempdir().unwrap();
        let error = upsert_dictionary_entry(UpsertDictionaryEntryArgs {
            cache_path: cache_path(&dir),
            entry: json!({ "headword_summary": "no headword" }),
        })
        .unwrap_err();
        assert!(error.contains("headword"));
    }

    #[test]
    fn cache_existence_and_count_track_the_distribution_db() {
        let dir = tempfile::tempdir().unwrap();

        assert!(!check_dictionary_cache_exists(cache_path(&dir)).unwrap());
        assert_eq!(count_dictionary_entries(cache_path(&dir)).unwrap(), 0);

        create_distribution_fixture(dir.path());

        assert!(check_dictionary_cache_exists(cache_path(&dir)).unwrap());
        assert_eq!(count_dictionary_entries(cache_path(&dir)).unwrap(), 2);
    }

    /// Smoke test against a real open-dictionary artifact. Run with:
    /// AICTIONARY_DICT_DIR=/path/to/dir/with/distribution.sqlite \
    ///     cargo test -- --ignored
    #[test]
    #[ignore = "requires a real distribution.sqlite via AICTIONARY_DICT_DIR"]
    fn smoke_real_distribution_lookup() {
        let dir = std::env::var("AICTIONARY_DICT_DIR")
            .expect("AICTIONARY_DICT_DIR must point at a directory with distribution.sqlite");

        let result = dictionary_query("Resolve".into(), dir.clone()).unwrap();
        assert!(matches!(result.source, LookupSource::Dictionary));
        assert_eq!(result.entry["headword"], "resolve");
        assert_eq!(result.entry["schema_version"], "distribution_entry_v5");
        assert!(result.entry["pos_groups"].as_array().is_some_and(|g| !g.is_empty()));

        let count = count_dictionary_entries(dir.clone()).unwrap();
        assert!(count > 20_000, "expected a full dictionary, got {count}");

        let metadata = dictionary_metadata(dir).unwrap();
        assert_eq!(metadata["distribution_schema_version"], "distribution_entry_v5");
    }

    #[test]
    fn metadata_includes_artifact_keys_and_user_entry_count() {
        let dir = tempfile::tempdir().unwrap();
        create_distribution_fixture(dir.path());

        upsert_dictionary_entry(UpsertDictionaryEntryArgs {
            cache_path: cache_path(&dir),
            entry: json!({ "headword": "widget" }),
        })
        .unwrap();

        let metadata = dictionary_metadata(cache_path(&dir)).unwrap();
        assert_eq!(metadata["entry_count"], 2);
        assert_eq!(metadata["distribution_schema_version"], "distribution_entry_v5");
        assert_eq!(metadata["user_entry_count"], 1);
    }
}
