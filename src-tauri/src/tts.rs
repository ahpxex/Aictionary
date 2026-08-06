use base64::{engine::general_purpose, Engine as _};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::audio_cache::AudioCacheWriter;

const FISH_TTS_URL: &str = "https://api.fish.audio/v1/tts";
const ELEVENLABS_TTS_URL: &str = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_EDGE_VOICE: &str = "en-US-AndrewNeural";
/// Base64 chunk granularity when replaying a fully synthesized buffer
/// through the streaming event pipeline.
const REPLAY_CHUNK_SIZE: usize = 48 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TtsStreamArgs {
    pub text: String,
    pub request_id: String,
    pub format: Option<String>,
    pub model: Option<String>,
    /// "edge" (built-in, no configuration), "fish", "elevenlabs", or
    /// "openai" for any OpenAI-compatible /v1/audio/speech endpoint.
    pub provider: Option<String>,
    /// Fish Audio custom voice reference id.
    pub reference_id: Option<String>,
    /// OpenAI-compatible voice name (e.g. "alloy").
    pub voice: Option<String>,
    /// Endpoint base for OpenAI-compatible providers.
    pub base_url: Option<String>,
    pub cache_file_path: Option<String>,
    pub latency: Option<String>,
    pub normalize: Option<bool>,
    #[serde(default)]
    pub api_key: String,
}

/// Build the synthesis endpoint from a user-supplied base URL. Accepts a
/// bare host, a base ending in /v1, or the full /audio/speech path.
fn openai_speech_endpoint(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/audio/speech") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/audio/speech")
    } else {
        format!("{base}/v1/audio/speech")
    }
}

/// Pull a human-readable message out of a provider error body. Fish uses
/// {"message": ...}; OpenAI-compatible endpoints use {"error": {"message": ...}};
/// ElevenLabs uses {"detail": {"message": ...}}.
fn extract_error_message(details: &str) -> Option<String> {
    let value = serde_json::from_str::<Value>(details).ok()?;
    value
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(Value::as_str)
        })
        .or_else(|| {
            value
                .get("detail")
                .and_then(|d| d.get("message"))
                .and_then(Value::as_str)
        })
        .map(str::to_string)
}

/// Synthesize through Microsoft Edge's read-aloud service. Free, keyless,
/// and therefore the app's zero-configuration default.
async fn synthesize_edge(voice: &str, text: &str) -> Result<Vec<u8>, String> {
    use msedge_tts::tts::client::tokio_runtime::connect_async;
    use msedge_tts::tts::SpeechConfig;

    let mut client = connect_async()
        .await
        .map_err(|err| format!("Failed to connect to Edge TTS: {err}"))?;

    let config = SpeechConfig {
        voice_name: voice.to_string(),
        audio_format: "audio-24khz-48kbitrate-mono-mp3".to_string(),
        pitch: 0,
        rate: 0,
        volume: 0,
    };

    let audio = client
        .synthesize(text, &config)
        .await
        .map_err(|err| format!("Edge TTS synthesis failed: {err}"))?;

    if audio.audio_bytes.is_empty() {
        return Err("Edge TTS returned no audio.".to_string());
    }

    Ok(audio.audio_bytes)
}

/// Write a fully synthesized buffer to the cache and replay it through the
/// same chunk/complete events the streaming providers emit, so the frontend
/// player needs no provider-specific handling.
fn emit_buffered_audio(
    app: &AppHandle,
    request_id: &str,
    format: &str,
    mut cache_writer: AudioCacheWriter,
    audio: &[u8],
) -> Result<(), String> {
    let mut total_bytes: u64 = 0;
    let mut sequence: u64 = 0;

    for chunk in audio.chunks(REPLAY_CHUNK_SIZE) {
        total_bytes += chunk.len() as u64;
        sequence += 1;

        cache_writer.write_chunk(chunk)?;

        app.emit(
            "tts-chunk",
            TtsChunkPayload {
                request_id: request_id.to_string(),
                chunk: general_purpose::STANDARD.encode(chunk),
                sequence,
                total_bytes,
            },
        )
        .ok();
    }

    let (cache_file_path, _) = cache_writer.finalize()?;

    app.emit(
        "tts-complete",
        TtsCompletePayload {
            request_id: request_id.to_string(),
            total_bytes,
            cache_file_path,
            format: format.to_string(),
        },
    )
    .ok();

    Ok(())
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
        provider,
        reference_id,
        voice,
        base_url,
        cache_file_path,
        latency,
        normalize,
        api_key,
    } = args;

    let resolved_api_key = api_key.trim().to_string();
    let provider_kind = provider.as_deref().unwrap_or("fish");

    // Fish Audio and ElevenLabs always need a key; Edge is keyless and
    // OpenAI-compatible wrappers often run locally without authentication.
    let needs_api_key = matches!(provider_kind, "fish" | "elevenlabs");
    if needs_api_key && resolved_api_key.is_empty() {
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

    // Edge synthesizes over a websocket and returns the whole buffer; it
    // re-enters the shared event pipeline instead of the HTTP stream below.
    if provider_kind == "edge" {
        let edge_voice = voice
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(DEFAULT_EDGE_VOICE);

        let audio = match synthesize_edge(edge_voice, &normalized_text).await {
            Ok(audio) => audio,
            Err(err) => {
                emit_tts_error(&app, &request_id, &err);
                return Err(err);
            }
        };

        if let Err(err) =
            emit_buffered_audio(&app, &request_id, &resolved_format, cache_writer, &audio)
        {
            emit_tts_error(&app, &request_id, &err);
            return Err(err);
        }

        return Ok(());
    }

    let client = reqwest::Client::new();

    let request = if provider_kind == "elevenlabs" {
        let voice_id = match voice
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            Some(value) => value.to_string(),
            None => {
                let message = "ElevenLabs voice id is missing.".to_string();
                emit_tts_error(&app, &request_id, &message);
                return Err(message);
            }
        };

        let body = serde_json::json!({
            "text": normalized_text,
            "model_id": model
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("eleven_multilingual_v2"),
        });

        client
            .post(format!(
                "{ELEVENLABS_TTS_URL}/{voice_id}/stream?output_format=mp3_44100_128"
            ))
            .header("xi-api-key", &resolved_api_key)
            .header("content-type", "application/json")
            .json(&body)
    } else if provider_kind == "openai" {
        let endpoint_base = base_url.as_deref().map(str::trim).unwrap_or_default();
        if endpoint_base.is_empty() {
            let message = "TTS endpoint URL is missing.".to_string();
            emit_tts_error(&app, &request_id, &message);
            return Err(message);
        }

        let body = serde_json::json!({
            "model": model
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("tts-1"),
            "input": normalized_text,
            "voice": voice
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("alloy"),
            "response_format": resolved_format,
        });

        let mut builder = client
            .post(openai_speech_endpoint(endpoint_base))
            .header("content-type", "application/json")
            .json(&body);
        if !resolved_api_key.is_empty() {
            builder = builder.bearer_auth(&resolved_api_key);
        }
        builder
    } else {
        let body = FishTtsBody {
            text: normalized_text,
            format: resolved_format.clone(),
            reference_id: reference_id.filter(|value| !value.trim().is_empty()),
            normalize: normalize.unwrap_or(true),
            latency: latency_value.to_string(),
        };

        client
            .post(FISH_TTS_URL)
            .header("authorization", format!("Bearer {resolved_api_key}"))
            .header("content-type", "application/json")
            .header("model", model.unwrap_or_else(|| "s1".to_string()))
            .json(&body)
    };

    let provider_name = match provider_kind {
        "openai" => "TTS provider",
        "elevenlabs" => "ElevenLabs",
        _ => "Fish Audio",
    };

    let response = match request.send().await {
        Ok(result) => result,
        Err(err) => {
            let message = format!("Failed to contact {provider_name}: {err}");
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

        let message = extract_error_message(&details).unwrap_or_else(|| {
            format!("{provider_name} request failed ({status}): {details}")
        });

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
