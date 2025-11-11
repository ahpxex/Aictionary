use std::path::PathBuf;

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
