//! Streaming native HTTP for WebView consumers that need a custom trust root.
use crate::net::{http_client_builder, NetworkSettings, ProxyMode};
use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::{
    future::{AbortHandle, Abortable},
    StreamExt,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tauri::ipc::Channel;

#[derive(Clone, Default)]
pub struct HttpRequests(Arc<Mutex<HashMap<String, AbortHandle>>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpRequest {
    id: String,
    url: String,
    method: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    network: NetworkSettings,
}

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HttpEvent {
    Headers {
        status: u16,
        headers: Vec<(String, String)>,
    },
    Chunk {
        data: String,
    },
    End,
    Error {
        message: String,
    },
}

async fn send(args: HttpRequest, events: &Channel<HttpEvent>) -> Result<(), String> {
    let url = reqwest::Url::parse(&args.url).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("HTTP or HTTPS URL required".into());
    }
    let loopback = url.host_str().is_some_and(|host| {
        host == "localhost"
            || host
                .trim_matches(['[', ']'])
                .parse::<std::net::IpAddr>()
                .is_ok_and(|ip| ip.is_loopback())
    });
    let mode = if loopback {
        ProxyMode::Direct
    } else {
        args.network.proxy_mode
    };
    let client = http_client_builder(
        mode,
        Some(&args.network.proxy_url),
        &args.network.custom_ca_pem,
    )?
    .read_timeout(std::time::Duration::from_secs(60))
    .timeout(std::time::Duration::from_secs(300))
    .build()
    .map_err(|e| e.to_string())?;
    let method = reqwest::Method::from_bytes(args.method.as_bytes()).map_err(|e| e.to_string())?;
    let mut request = client.request(method, url);
    for (name, value) in args.headers {
        request = request.header(name, value);
    }
    if let Some(body) = args.body {
        request = request.body(body);
    }
    let response = request.send().await.map_err(|e| e.to_string())?;
    events
        .send(HttpEvent::Headers {
            status: response.status().as_u16(),
            headers: response
                .headers()
                .iter()
                .filter_map(|(name, value)| {
                    value
                        .to_str()
                        .ok()
                        .map(|value| (name.to_string(), value.to_string()))
                })
                .collect(),
        })
        .map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        events
            .send(HttpEvent::Chunk {
                data: STANDARD.encode(chunk),
            })
            .map_err(|e| e.to_string())?;
    }
    events.send(HttpEvent::End).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_http_request(
    args: HttpRequest,
    on_event: Channel<HttpEvent>,
    requests: tauri::State<'_, HttpRequests>,
) -> Result<(), String> {
    let requests = requests.inner().clone();
    let id = args.id.clone();
    let (abort, registration) = AbortHandle::new_pair();
    {
        let mut active = requests.0.lock().map_err(|e| e.to_string())?;
        if active.contains_key(&id) {
            return Err("Duplicate HTTP request ID".into());
        }
        active.insert(id.clone(), abort);
    }
    tauri::async_runtime::spawn(async move {
        if let Ok(Err(message)) = Abortable::new(send(args, &on_event), registration).await {
            let _ = on_event.send(HttpEvent::Error { message });
        }
        if let Ok(mut active) = requests.0.lock() {
            active.remove(&id);
        }
    });
    Ok(())
}

#[tauri::command]
pub fn cancel_http_request(id: String, requests: tauri::State<'_, HttpRequests>) {
    if let Ok(mut active) = requests.0.lock() {
        if let Some(abort) = active.remove(&id) {
            abort.abort();
        }
    }
}
