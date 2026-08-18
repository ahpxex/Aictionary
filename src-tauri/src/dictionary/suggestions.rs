use rusqlite::{Connection, OpenFlags};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::SystemTime;

use super::types::{DictionarySuggestion, LookupSource};
use super::utils::{normalize_headword, resolve_cache_dir, DISTRIBUTION_DB_FILE, USER_DB_FILE};

const SUGGESTION_LIMIT: usize = 5;

fn open_read_only(path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|err| format!("Failed to open dictionary database: {err}"))
}

struct SuggestionRow {
    headword: Box<str>,
    normalized: Box<str>,
    gloss: Option<Box<str>>,
}

struct SuggestionIndex {
    cache_dir: PathBuf,
    fingerprint: Option<(u64, SystemTime)>,
    rows: Vec<SuggestionRow>,
}

static SUGGESTION_INDEX: Mutex<Option<SuggestionIndex>> = Mutex::new(None);

fn distribution_fingerprint(cache_dir: &Path) -> Option<(u64, SystemTime)> {
    let meta = fs::metadata(cache_dir.join(DISTRIBUTION_DB_FILE)).ok()?;
    Some((meta.len(), meta.modified().ok()?))
}

fn load_suggestion_index(cache_dir: &Path) -> Result<SuggestionIndex, String> {
    let db_path = cache_dir.join(DISTRIBUTION_DB_FILE);
    let fingerprint = distribution_fingerprint(cache_dir);
    let mut rows = Vec::new();

    if db_path.is_file() {
        let conn = open_read_only(&db_path)?;
        let mut stmt = conn
            .prepare(
                "SELECT e.headword, e.normalized_headword, m.short_gloss
                 FROM entries e
                 LEFT JOIN meanings m ON m.entry_id = e.entry_id
                 WHERE m.short_gloss IS NOT NULL AND m.short_gloss <> ''
                 ORDER BY e.normalized_headword,
                   CASE m.priority WHEN 'core' THEN 0 WHEN 'common' THEN 1 ELSE 2 END,
                   length(m.short_gloss)",
            )
            .map_err(|err| format!("Failed to read dictionary database: {err}"))?;
        let mapped = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|err| format!("Failed to query dictionary database: {err}"))?;
        for row in mapped {
            let (headword, normalized, gloss) =
                row.map_err(|err| format!("Failed to query dictionary database: {err}"))?;
            if rows
                .last()
                .is_some_and(|item: &SuggestionRow| item.normalized.as_ref() == normalized)
            {
                continue;
            }
            rows.push(SuggestionRow {
                headword: headword.into(),
                normalized: normalized.into(),
                gloss: Some(gloss.into()),
            });
        }
    }

    Ok(SuggestionIndex {
        cache_dir: cache_dir.to_path_buf(),
        fingerprint,
        rows,
    })
}

fn with_suggestion_index<T>(
    cache_dir: &Path,
    f: impl FnOnce(&SuggestionIndex) -> T,
) -> Result<T, String> {
    let mut guard = SUGGESTION_INDEX
        .lock()
        .map_err(|_| "Suggestion index is unavailable".to_string())?;

    let stale = match guard.as_ref() {
        Some(index) => {
            index.cache_dir != cache_dir || index.fingerprint != distribution_fingerprint(cache_dir)
        }
        None => true,
    };
    if stale {
        *guard = Some(load_suggestion_index(cache_dir)?);
    }

    Ok(f(guard.as_ref().expect("index was just ensured")))
}

fn bounded_levenshtein(left: &str, right: &str, limit: usize) -> Option<usize> {
    let left: Vec<char> = left.chars().collect();
    let right: Vec<char> = right.chars().collect();
    if left.len().abs_diff(right.len()) > limit {
        return None;
    }

    let mut previous: Vec<usize> = (0..=right.len()).collect();
    let mut current = vec![0; right.len() + 1];
    for (left_index, left_char) in left.iter().enumerate() {
        current[0] = left_index + 1;
        let mut row_min = current[0];
        for (right_index, right_char) in right.iter().enumerate() {
            current[right_index + 1] = if left_char == right_char {
                previous[right_index]
            } else {
                1 + previous[right_index]
                    .min(previous[right_index + 1])
                    .min(current[right_index])
            };
            row_min = row_min.min(current[right_index + 1]);
        }
        if row_min > limit {
            return None;
        }
        std::mem::swap(&mut previous, &mut current);
    }

    (previous[right.len()] <= limit).then_some(previous[right.len()])
}

/// Lower score is better: exact prefix, then a bounded fuzzy match.
fn suggestion_score(query: &str, candidate: &str) -> Option<(u8, usize)> {
    if candidate.starts_with(query) {
        return Some((0, candidate.len().saturating_sub(query.len())));
    }
    if query.chars().count() < 2 || candidate.chars().next() != query.chars().next() {
        return None;
    }

    let limit = if query.chars().count() <= 4 { 1 } else { 2 };
    bounded_levenshtein(query, candidate, limit).map(|distance| (1, distance))
}

struct RankedSuggestion {
    score: (u8, usize, usize, u8, String),
    suggestion: DictionarySuggestion,
}

struct SuggestionCandidate {
    headword: String,
    normalized: String,
    gloss: Option<String>,
    source: LookupSource,
}

fn rank_suggestions(
    query: &str,
    rows: impl IntoIterator<Item = SuggestionCandidate>,
) -> Vec<DictionarySuggestion> {
    let mut ranked = rows
        .into_iter()
        .filter_map(|candidate| {
            let (match_rank, distance) = suggestion_score(query, &candidate.normalized)?;
            Some(RankedSuggestion {
                score: (
                    match_rank,
                    distance,
                    candidate.normalized.len(),
                    matches!(candidate.source, LookupSource::User) as u8,
                    candidate.normalized.clone(),
                ),
                suggestion: DictionarySuggestion {
                    headword: candidate.headword,
                    gloss: candidate.gloss,
                    source: candidate.source,
                },
            })
        })
        .collect::<Vec<_>>();

    ranked.sort_by(|left, right| left.score.cmp(&right.score));
    let mut seen = HashSet::new();
    ranked
        .into_iter()
        .filter_map(|item| {
            let key = normalize_headword(&item.suggestion.headword);
            seen.insert(key).then_some(item.suggestion)
        })
        .take(SUGGESTION_LIMIT)
        .collect()
}

fn suggestion_rows_from_distribution(
    cache_dir: &Path,
    query: &str,
) -> Result<Vec<SuggestionCandidate>, String> {
    with_suggestion_index(cache_dir, |index| {
        index
            .rows
            .iter()
            .filter(|row| suggestion_score(query, &row.normalized).is_some())
            .map(|row| SuggestionCandidate {
                headword: row.headword.to_string(),
                normalized: row.normalized.to_string(),
                gloss: row.gloss.as_ref().map(|gloss| gloss.to_string()),
                source: LookupSource::Dictionary,
            })
            .collect()
    })
}

fn suggestion_rows_from_user(
    cache_dir: &Path,
    query: &str,
) -> Result<Vec<SuggestionCandidate>, String> {
    let db_path = cache_dir.join(USER_DB_FILE);
    if !db_path.is_file() {
        return Ok(Vec::new());
    }

    let conn = open_read_only(&db_path)?;
    let mut stmt = conn
        .prepare("SELECT headword, normalized_headword, document_json FROM user_entries")
        .map_err(|err| format!("Failed to read user dictionary: {err}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|err| format!("Failed to query user dictionary: {err}"))?;

    rows.filter_map(|row| match row {
        Ok((headword, normalized, document)) if suggestion_score(query, &normalized).is_some() => {
            Some(Ok(SuggestionCandidate {
                headword,
                normalized,
                gloss: user_gloss(&document),
                source: LookupSource::User,
            }))
        }
        Ok(_) => None,
        Err(error) => Some(Err(format!("Failed to query user dictionary: {error}"))),
    })
    .collect()
}

fn user_gloss(document: &str) -> Option<String> {
    let document = serde_json::from_str::<Value>(document).ok()?;
    document
        .get("pos_groups")?
        .as_array()?
        .iter()
        .filter_map(|group| group.get("meanings").and_then(Value::as_array))
        .flatten()
        .filter_map(|meaning| {
            let gloss = meaning.get("short_gloss")?.as_str()?.trim();
            (!gloss.is_empty()).then_some((
                match meaning.get("priority").and_then(Value::as_str) {
                    Some("core") => 0,
                    Some("common") => 1,
                    _ => 2,
                },
                gloss.to_string(),
            ))
        })
        .min_by_key(|(priority, gloss)| (*priority, gloss.chars().count()))
        .map(|(_, gloss)| gloss)
}

/// Return at most five local headword suggestions for a partial query.
#[tauri::command]
pub fn dictionary_suggest(
    query: String,
    cache_path: String,
) -> Result<Vec<DictionarySuggestion>, String> {
    let query = normalize_headword(query.trim());
    let cache_path = cache_path.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    if cache_path.is_empty() {
        return Err("Dictionary cache path is not configured".into());
    }

    let cache_dir = resolve_cache_dir(cache_path)?;
    let mut rows = suggestion_rows_from_distribution(&cache_dir, &query)?;
    rows.extend(suggestion_rows_from_user(&cache_dir, &query)?);
    Ok(rank_suggestions(&query, rows))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rows(words: &[&str]) -> Vec<SuggestionCandidate> {
        words
            .iter()
            .map(|word| SuggestionCandidate {
                headword: (*word).into(),
                normalized: (*word).into(),
                gloss: None,
                source: LookupSource::Dictionary,
            })
            .collect()
    }

    #[test]
    fn prefix_matches_come_before_fuzzy_matches_and_results_are_capped() {
        let results = rank_suggestions(
            "re",
            rows(&["resolve", "reply", "rescue", "result", "return", "resin"]),
        );

        assert_eq!(results.len(), SUGGESTION_LIMIT);
        assert_eq!(
            results
                .iter()
                .map(|item| item.headword.as_str())
                .collect::<Vec<_>>(),
            ["reply", "resin", "rescue", "result", "return"]
        );
    }

    #[test]
    fn fuzzy_matching_accepts_a_transposition_within_bound() {
        let results = rank_suggestions("resovle", rows(&["resolve", "respond"]));

        assert_eq!(results[0].headword, "resolve");
    }
}
