//! AnkiConnect is a native localhost API. Sending from the WebView subjects
//! it to CORS / mixed-content rules and can route localhost through a proxy.
use serde_json::Value;
use std::time::Duration;

#[tauri::command]
pub async fn anki_request(api_url: String, payload: Value) -> Result<Value, String> {
    let url = reqwest::Url::parse(api_url.trim())
        .map_err(|_| "Invalid AnkiConnect URL".to_string())?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err("AnkiConnect requires an HTTP or HTTPS URL".into());
    }

    let client = reqwest::Client::builder()
        // Anki can also be on a local LAN. Never send cards to an outbound proxy.
        .no_proxy()
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| err.to_string())?;
    let response = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|err| format!("Cannot reach AnkiConnect. Open Anki and enable the AnkiConnect add-on: {err}"))?
        .error_for_status()
        .map_err(|err| format!("AnkiConnect request failed: {err}"))?;
    response.json().await.map_err(|err| format!("Invalid AnkiConnect response: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    #[tokio::test]
    async fn calls_local_anki_without_browser_origin_or_cors() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = vec![0; 4096];
            let count = stream.read(&mut bytes).await.unwrap();
            let request = String::from_utf8_lossy(&bytes[..count]);
            assert!(request.starts_with("POST / HTTP/1.1"));
            assert!(!request.to_lowercase().contains("\r\norigin:"));
            let body = r#"{"result":123,"error":null}"#;
            stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
        });
        let result = anki_request(format!("http://{address}"), serde_json::json!({"action":"version","version":6})).await.unwrap();
        assert_eq!(result["result"], 123);
        server.await.unwrap();
    }

    #[tokio::test]
    async fn rejects_non_http_urls() {
        assert!(anki_request("file:///tmp/anki".into(), Value::Null).await.is_err());
    }
}
