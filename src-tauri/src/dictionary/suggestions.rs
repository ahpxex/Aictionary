use super::utils::{normalize_headword, resolve_cache_dir, DISTRIBUTION_DB_FILE, USER_DB_FILE};
use rusqlite::{Connection, OpenFlags};
use std::collections::BTreeMap;

const LIMIT: usize = 8;

// Range bounds use the existing BINARY lookup indexes. LIKE would require a
// separate NOCASE index and also interprets user input such as % and _.
fn prefix_end(prefix: &str) -> Option<String> {
    let mut chars: Vec<char> = prefix.chars().collect();
    while let Some(last) = chars.pop() {
        let mut next = last as u32 + 1;
        if next == 0xD800 {
            next = 0xE000;
        }
        if let Some(next) = char::from_u32(next) {
            chars.push(next);
            return Some(chars.into_iter().collect());
        }
    }
    None
}

fn suggest(prefix: &str, cache_path: &str) -> Result<Vec<String>, String> {
    let prefix = normalize_headword(prefix.trim());
    if prefix.is_empty() || cache_path.trim().is_empty() {
        return Ok(vec![]);
    }
    let Some(end) = prefix_end(&prefix) else {
        return Ok(vec![]);
    };
    let dir = resolve_cache_dir(cache_path)?;
    let mut matches = BTreeMap::<String, String>::new();
    for (file, table) in [
        (DISTRIBUTION_DB_FILE, "entries"),
        (USER_DB_FILE, "user_entries"),
    ] {
        let path = dir.join(file);
        if !path.is_file() {
            continue;
        }
        let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| e.to_string())?;
        let languages = if table == "entries" {
            let mut stmt = conn
                .prepare("SELECT DISTINCT headword_language_code FROM entries")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |r| r.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        } else {
            vec![String::new()]
        };
        let language_filter = if table == "entries" {
            "AND headword_language_code = ?3"
        } else {
            "AND ?3 = ''"
        };
        let mut stmt = conn
            .prepare(&format!(
                "SELECT normalized_headword, headword FROM {table}
             WHERE normalized_headword >= ?1 AND normalized_headword < ?2 {language_filter}
             ORDER BY normalized_headword LIMIT {LIMIT}"
            ))
            .map_err(|e| e.to_string())?;
        for language in languages {
            let rows = stmt
                .query_map(rusqlite::params![prefix, end, language], |r| {
                    Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
                })
                .map_err(|e| e.to_string())?;
            for row in rows {
                let (normalized, headword) = row.map_err(|e| e.to_string())?;
                matches.entry(normalized).or_insert(headword);
            }
        }
    }
    Ok(matches.into_values().take(LIMIT).collect())
}

#[tauri::command]
pub async fn dictionary_suggest(prefix: String, cache_path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || suggest(&prefix, &cache_path))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_sources_preserves_spelling_and_treats_wildcards_literally() {
        let dir = tempfile::tempdir().unwrap();
        let conn = Connection::open(dir.path().join(DISTRIBUTION_DB_FILE)).unwrap();
        conn.execute_batch("CREATE TABLE entries (headword TEXT, normalized_headword TEXT, headword_language_code TEXT);
            CREATE INDEX lookup ON entries(headword_language_code, normalized_headword);
            INSERT INTO entries VALUES ('Apple','apple','en'), ('apply','apply','en'), ('a%b','a%b','en');").unwrap();
        let conn = Connection::open(dir.path().join(USER_DB_FILE)).unwrap();
        conn.execute_batch(
            "CREATE TABLE user_entries (headword TEXT, normalized_headword TEXT PRIMARY KEY);
            INSERT INTO user_entries VALUES ('apple','apple'), ('app','app');",
        )
        .unwrap();
        let path = dir.path().to_str().unwrap();
        assert_eq!(suggest(" APP ", path).unwrap(), ["app", "Apple", "apply"]);
        assert_eq!(suggest("a%", path).unwrap(), ["a%b"]);
        assert!(suggest("", path).unwrap().is_empty());
        assert!(suggest("a_", path).unwrap().is_empty());
    }

    #[test]
    fn missing_databases_are_an_empty_list() {
        let dir = tempfile::tempdir().unwrap();
        assert!(suggest("hello", dir.path().to_str().unwrap())
            .unwrap()
            .is_empty());
    }
}
