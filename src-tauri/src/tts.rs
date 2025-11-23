use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio_cache::AudioCacheWriter;

const FISH_TTS_URL: &str = "https://api.fish.audio/v1/tts";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStreamArgs {
    pub text: String,
    pub request_id: String,
    pub format: Option<String>,
    pub model: Option<String>,
    pub reference_id: Option<String>,
    pub cache_file_path: Option<String>,
    pub latency: Option<String>,
    pub normalize: Option<bool>,
    pub api_key: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsChunkPayload {
    request_id: String,
    chunk: String,
    sequence: u64,
    total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsCompletePayload {
    request_id: String,
    total_bytes: u64,
    cache_file_path: String,
    format: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsErrorPayload {
    request_id: String,
    message: String,
}

#[derive(Serialize)]
struct FishTtsBody {
    text: String,
    format: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    reference_id: Option<String>,
    normalize: bool,
    latency: String,
}

#[tauri::command]
pub async fn start_tts_stream(app: AppHandle, args: TtsStreamArgs) -> Result<(), String> {
    let TtsStreamArgs {
        text,
        request_id,
        format,
        model,
        reference_id,
        cache_file_path,
        latency,
        normalize,
        api_key,
    } = args;

    let resolved_api_key = api_key.trim().to_string();
    if resolved_api_key.is_empty() {
        let message = "Audio API key is missing.".to_string();
        emit_tts_error(&app, &request_id, &message);
        return Err(message);
    }

    let resolved_format = format
        .unwrap_or_else(|| "mp3".to_string())
        .to_ascii_lowercase();

    if !matches!(resolved_format.as_str(), "mp3" | "wav" | "opus") {
        let message = "Unsupported audio format: use mp3, wav, or opus.".to_string();
        emit_tts_error(&app, &request_id, &message);
        return Err(message);
    }

    let latency_value = if matches!(latency.as_deref(), Some("balanced")) {
        "balanced"
    } else {
        "normal"
    };

    let normalized_text = text.trim().to_string();
    if normalized_text.is_empty() {
        let message = "Text is required.".to_string();
        emit_tts_error(&app, &request_id, &message);
        return Err(message);
    }

    let cache_path = match resolve_cache_path(&app, cache_file_path, &request_id, &resolved_format)
    {
        Ok(path) => path,
        Err(err) => {
            emit_tts_error(&app, &request_id, &err);
            return Err(err);
        }
    };

    let mut cache_writer = match AudioCacheWriter::create(&cache_path) {
        Ok(writer) => writer,
        Err(err) => {
            emit_tts_error(&app, &request_id, &err);
            return Err(err);
        }
    };

    let client = reqwest::Client::new();
    let body = FishTtsBody {
        text: normalized_text,
        format: resolved_format.clone(),
        reference_id: reference_id.filter(|value| !value.trim().is_empty()),
        normalize: normalize.unwrap_or(true),
        latency: latency_value.to_string(),
    };

    let resolved_model = model.unwrap_or_else(|| "s1".to_string());

    let response = match client
        .post(FISH_TTS_URL)
        .header("authorization", format!("Bearer {resolved_api_key}"))
        .header("content-type", "application/json")
        .header("model", resolved_model)
        .json(&body)
        .send()
        .await
    {
        Ok(result) => result,
        Err(err) => {
            let message = format!("Failed to contact Fish Audio: {err}");
            emit_tts_error(&app, &request_id, &message);
            return Err(message);
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let details = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error message".to_string());
        let message = format!("Fish Audio request failed ({status}): {details}");
        emit_tts_error(&app, &request_id, &message);
        return Err(message);
    }

    let mut stream = response.bytes_stream();
    let mut total_bytes: u64 = 0;
    let mut sequence: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = match chunk_result {
            Ok(data) => data,
            Err(err) => {
                let message = format!("Failed to read audio chunk: {err}");
                emit_tts_error(&app, &request_id, &message);
                return Err(message);
            }
        };

        total_bytes += chunk.len() as u64;
        sequence += 1;

        if let Err(err) = cache_writer.write_chunk(&chunk) {
            emit_tts_error(&app, &request_id, &err);
            return Err(err);
        }

        let encoded = general_purpose::STANDARD.encode(chunk);

        app.emit(
            "tts-chunk",
            TtsChunkPayload {
                request_id: request_id.clone(),
                chunk: encoded,
                sequence,
                total_bytes,
            },
        )
        .ok();
    }

    let (cache_file_path, _) = match cache_writer.finalize() {
        Ok(result) => result,
        Err(err) => {
            emit_tts_error(&app, &request_id, &err);
            return Err(err);
        }
    };

    app.emit(
        "tts-complete",
        TtsCompletePayload {
            request_id,
            total_bytes,
            cache_file_path,
            format: resolved_format,
        },
    )
    .ok();

    Ok(())
}

fn resolve_cache_path(
    app: &AppHandle,
    provided: Option<String>,
    request_id: &str,
    extension: &str,
) -> Result<PathBuf, String> {
    if let Some(path) = provided.filter(|value| !value.trim().is_empty()) {
        return Ok(PathBuf::from(path));
    }

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|err| err.to_string())?
        .join("tts-cache");

    Ok(cache_dir.join(format!("{request_id}.{extension}")))
}

fn emit_tts_error(app: &AppHandle, request_id: &str, message: &str) {
    app.emit(
        "tts-error",
        TtsErrorPayload {
            request_id: request_id.to_string(),
            message: message.to_string(),
        },
    )
    .ok();
}
