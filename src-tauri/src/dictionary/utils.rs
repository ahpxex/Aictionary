use std::path::PathBuf;

/// File name of the distributed dictionary artifact inside the cache
/// directory, matching the `distribution.sqlite.gz` release asset of
/// ahpxex/open-dictionary after decompression.
pub const DISTRIBUTION_DB_FILE: &str = "distribution.sqlite";

/// File name of the local database holding user-generated entries. Kept
/// separate from the distributed artifact so re-downloading the dictionary
/// never touches user data.
pub const USER_DB_FILE: &str = "user_dictionary.sqlite";

/// Resolves a cache directory path to an absolute PathBuf.
/// If the path is already absolute, returns it as-is.
/// If relative, resolves it against the current working directory.
pub fn resolve_cache_dir(cache_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(cache_path);
    if path.is_absolute() {
        Ok(path)
    } else {
        let cwd = std::env::current_dir().map_err(|err| err.to_string())?;
        Ok(cwd.join(path))
    }
}

/// Mirrors the upstream normalization rule: `normalized_headword` is the
/// lowercased headword, and lookups match on it.
pub fn normalize_headword(word: &str) -> String {
    word.trim().to_lowercase()
}
