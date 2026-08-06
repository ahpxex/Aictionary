use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub struct AudioCacheWriter {
    path: PathBuf,
    writer: BufWriter<File>,
    bytes_written: u64,
}

impl AudioCacheWriter {
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Failed to create cache directory: {err}"))?;
        }

        let file =
            File::create(&path).map_err(|err| format!("Failed to prepare cache file: {err}"))?;

        Ok(Self {
            path,
            writer: BufWriter::new(file),
            bytes_written: 0,
        })
    }

    pub fn write_chunk(&mut self, chunk: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(chunk)
            .map_err(|err| format!("Failed to write audio chunk: {err}"))?;
        self.bytes_written += chunk.len() as u64;
        Ok(())
    }

    pub fn finalize(mut self) -> Result<(String, u64), String> {
        self.writer
            .flush()
            .map_err(|err| format!("Failed to flush cached audio: {err}"))?;
        let path = self.path.to_string_lossy().to_string();
        Ok((path, self.bytes_written))
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheArgs {
    pub word: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub voice_id: Option<String>,
    pub format: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheEntry {
    pub path: String,
    pub exists: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioCacheReadArgs {
    pub path: String,
}

#[tauri::command]
pub async fn resolve_audio_cache_entry(
    app: AppHandle,
    args: AudioCacheArgs,
) -> Result<AudioCacheEntry, String> {
    let path = build_audio_cache_path(&app, &args)?;
    let exists = path.exists();

    Ok(AudioCacheEntry {
        path: path.to_string_lossy().to_string(),
        exists,
    })
}

#[tauri::command]
pub async fn read_audio_cache_file(
    app: AppHandle,
    args: AudioCacheReadArgs,
) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(&args.path);
    if !path.exists() {
        return Err("Audio cache file does not exist.".into());
    }

    ensure_path_in_audio_dir(&app, &path)?;

    tokio::fs::read(&path)
        .await
        .map_err(|err| format!("Failed to read cached audio: {err}"))
}

fn build_audio_cache_path(app: &AppHandle, args: &AudioCacheArgs) -> Result<PathBuf, String> {
    let audio_dir = audio_directory(app)?;

    let format_input = args.format.as_deref().unwrap_or("mp3");
    let format = sanitize_segment(Some(format_input)).unwrap_or_else(|| "mp3".into());
    let word_segment = sanitize_segment(Some(args.word.as_str())).unwrap_or_else(|| "word".into());
    let provider_segment = sanitize_segment(args.provider.as_deref());
    let model_segment = sanitize_segment(args.model.as_deref());
    let voice_segment = sanitize_segment(args.voice_id.as_deref());

    let mut filename = word_segment;
    if let Some(provider) = provider_segment {
        filename.push_str("--");
        filename.push_str(&provider);
    }
    if let Some(model) = model_segment {
        filename.push_str("--");
        filename.push_str(&model);
    }
    if let Some(voice) = voice_segment {
        filename.push_str("--");
        filename.push_str(&voice);
    }
    filename.push('.');
    filename.push_str(&format);

    Ok(audio_dir.join(filename))
}

fn audio_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to access app data dir: {err}"))?;
    let audio_dir = base_dir.join("audio");

    if !audio_dir.exists() {
        fs::create_dir_all(&audio_dir)
            .map_err(|err| format!("Failed to create audio cache directory: {err}"))?;
    }

    Ok(audio_dir)
}

fn ensure_path_in_audio_dir(app: &AppHandle, path: &Path) -> Result<(), String> {
    let audio_dir = audio_directory(app)?;
    let audio_dir = audio_dir
        .canonicalize()
        .map_err(|err| format!("Failed to resolve audio directory: {err}"))?;
    let target_path = path
        .canonicalize()
        .map_err(|err| format!("Failed to resolve cache file path: {err}"))?;

    if !target_path.starts_with(&audio_dir) {
        return Err("Access to audio cache file is not allowed.".into());
    }

    Ok(())
}

fn sanitize_segment(value: Option<&str>) -> Option<String> {
    let Some(raw) = value else {
        return None;
    };

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut result = String::new();
    let mut last_was_dash = false;

    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash {
            result.push('-');
            last_was_dash = true;
        }
    }

    let sanitized = result.trim_matches('-').to_string();
    if sanitized.is_empty() {
        None
    } else {
        Some(sanitized)
    }
}
