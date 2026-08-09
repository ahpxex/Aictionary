//! Microsoft Edge's read-aloud service, spoken directly.
//!
//! This replaces the `msedge-tts` crate rather than wrapping it. That crate
//! verifies TLS through `rustls-platform-verifier`, which on Android needs a
//! JNI handshake plus a Kotlin component on the classpath - and the dependency
//! graph ended up with two incompatible versions of it, one behind the
//! websocket and one behind the voice list, so no single Android library could
//! satisfy both. Bundled webpki roots sidestep the platform store entirely and
//! behave identically on all four targets.
//!
//! Owning the connection also means owning the proxy. The endpoint refuses a
//! direct websocket upgrade on some networks while answering ordinary HTTPS
//! from the same host, so being able to route the socket is what makes the
//! zero-configuration provider usable there at all.

use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::http::header;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::Connector;

const HOST: &str = "speech.platform.bing.com";
const TRUSTED_CLIENT_TOKEN: &str = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const VOICE_LIST_URL: &str = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_PATH: &str = "/consumer/speech/synthesize/readaloud/edge/v1";
const USER_AGENT: &str = "Mozilla/5.0 (Linux; Android 10; HD1913) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.193 Mobile Safari/537.36 EdgA/143.0.3650.125";
const ORIGIN: &str = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";
/// Ships alongside the Sec-MS-GEC token; the service rejects a stale pairing.
const SEC_MS_GEC_VERSION: &str = "1-130.0.2849.68";

/// The default output format: mp3 is what the frontend player expects.
pub const AUDIO_FORMAT: &str = "audio-24khz-48kbitrate-mono-mp3";

/// One voice from the Edge catalog, trimmed to what the picker shows.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct Voice {
    #[serde(rename = "ShortName")]
    pub short_name: Option<String>,
    #[serde(rename = "Locale")]
    pub locale: Option<String>,
    #[serde(rename = "Gender")]
    pub gender: Option<String>,
    #[serde(rename = "FriendlyName")]
    pub friendly_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpeechConfig {
    pub voice: String,
    pub audio_format: String,
}

impl SpeechConfig {
    pub fn new(voice: &str) -> Self {
        Self {
            voice: voice.to_string(),
            audio_format: AUDIO_FORMAT.to_string(),
        }
    }
}

/// Fetch the voice catalog. Plain HTTPS, so this keeps working on networks
/// where the synthesis websocket cannot connect.
pub async fn list_voices(client: &reqwest::Client) -> Result<Vec<Voice>, String> {
    let response = client
        .get(VOICE_LIST_URL)
        .header(header::USER_AGENT, USER_AGENT)
        .header(header::ORIGIN, ORIGIN)
        .send()
        .await
        .map_err(|err| format!("Failed to load Edge voices: {err}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to load Edge voices: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<Vec<Voice>>()
        .await
        .map_err(|err| format!("Failed to parse the Edge voice list: {err}"))
}

/// The DRM-ish token the service started demanding from clients outside a few
/// regions. It is a SHA-256 over the current Windows tick count rounded down
/// to a five-minute window, salted with the public client token.
fn sec_ms_gec() -> String {
    use sha2::Digest;

    let since_epoch = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    // Windows counts 100ns ticks from 1601-01-01, 11644473600s before the Unix
    // epoch, and the service expects the value snapped to a 5 minute boundary.
    let ticks = (since_epoch.as_nanos() + 11_644_473_600 * 1_000_000_000) / 100;
    let ticks = ticks - ticks % 3_000_000_000;

    let digest = sha2::Sha256::digest(format!("{ticks}{TRUSTED_CLIENT_TOKEN}").as_bytes());
    digest.iter().map(|byte| format!("{byte:02X}")).collect()
}

fn timestamp() -> String {
    chrono::Local::now().to_rfc2822()
}

fn config_message(config: &SpeechConfig) -> Message {
    let body = format!(
        r#"{{"context":{{"synthesis":{{"audio":{{"metadataoptions":{{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"}},"outputFormat":"{}"}}}}}}}}"#,
        config.audio_format
    );
    Message::Text(
        format!(
            "X-Timestamp:{}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{}",
            timestamp(),
            body
        )
        .into(),
    )
}

/// SSML is XML, so anything the user looked up has to be escaped before it is
/// pasted into the document - a headword containing `&` would otherwise make
/// the service reject the whole request.
fn escape_xml(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

fn ssml_message(text: &str, config: &SpeechConfig) -> Message {
    let ssml = format!(
        "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\
<voice name='{}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>{}</prosody></voice></speak>",
        escape_xml(&config.voice),
        escape_xml(text)
    );
    Message::Text(
        format!(
            "X-RequestId:{}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{}\r\nPath:ssml\r\n\r\n{}",
            uuid::Uuid::new_v4().simple(),
            timestamp(),
            ssml
        )
        .into(),
    )
}

/// Any transport the websocket can ride on: a direct socket, a CONNECT tunnel
/// or a SOCKS5 connection all end up here.
trait Transport: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> Transport for T {}

/// Open the TCP path to the endpoint, going through a proxy when one is given.
async fn open_transport(proxy: Option<&str>) -> Result<Box<dyn Transport>, String> {
    let Some(proxy) = proxy else {
        let stream = TcpStream::connect((HOST, 443))
            .await
            .map_err(|err| format!("Failed to reach {HOST}: {err}"))?;
        stream.set_nodelay(true).ok();
        return Ok(Box::new(stream));
    };

    let url = url_parts(proxy)?;

    match url.scheme.as_str() {
        "socks5" | "socks5h" | "socks" => {
            let stream = tokio_socks::tcp::Socks5Stream::connect(
                url.authority.as_str(),
                (HOST.to_string(), 443u16),
            )
            .await
            .map_err(|err| format!("SOCKS5 proxy {} refused the connection: {err}", url.authority))?;
            Ok(Box::new(stream))
        }
        "http" | "https" => {
            let mut stream = TcpStream::connect(url.authority.as_str())
                .await
                .map_err(|err| format!("Failed to reach proxy {}: {err}", url.authority))?;
            stream.set_nodelay(true).ok();
            http_connect(&mut stream, url.credentials.as_deref()).await?;
            Ok(Box::new(stream))
        }
        other => Err(format!(
            "Unsupported proxy scheme '{other}'. Use http, https or socks5."
        )),
    }
}

struct ProxyUrl {
    scheme: String,
    authority: String,
    credentials: Option<String>,
}

/// Split `<scheme>://<user>:<pass>@<host>:<port>`. A bare `host:port` is
/// treated as HTTP, which is what every other tool does with a proxy string
/// that omits the scheme.
fn url_parts(proxy: &str) -> Result<ProxyUrl, String> {
    let proxy = proxy.trim();
    let (scheme, rest) = match proxy.split_once("://") {
        Some((scheme, rest)) => (scheme.to_ascii_lowercase(), rest),
        None => ("http".to_string(), proxy),
    };

    let rest = rest.trim_end_matches('/');
    let (credentials, authority) = match rest.rsplit_once('@') {
        Some((credentials, authority)) => (Some(credentials.to_string()), authority),
        None => (None, rest),
    };

    if authority.is_empty() || !authority.contains(':') {
        return Err(format!(
            "Proxy address '{proxy}' needs a host and a port, for example http://127.0.0.1:7890."
        ));
    }

    Ok(ProxyUrl {
        scheme,
        authority: authority.to_string(),
        credentials,
    })
}

/// Establish a CONNECT tunnel to the endpoint through an HTTP proxy.
async fn http_connect<S>(stream: &mut S, credentials: Option<&str>) -> Result<(), String>
where
    S: AsyncRead + AsyncWrite + Unpin,
{
    use base64::{engine::general_purpose, Engine as _};

    let authorization = credentials
        .map(|credentials| {
            format!(
                "Proxy-Authorization: Basic {}\r\n",
                general_purpose::STANDARD.encode(credentials)
            )
        })
        .unwrap_or_default();

    let request =
        format!("CONNECT {HOST}:443 HTTP/1.1\r\nHost: {HOST}:443\r\n{authorization}\r\n");
    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|err| format!("Failed to send CONNECT to the proxy: {err}"))?;

    // Read only until the end of the headers: whatever follows already belongs
    // to the tunnelled TLS session and must not be consumed here.
    let mut response = Vec::with_capacity(256);
    let mut byte = [0u8; 1];
    while !response.ends_with(b"\r\n\r\n") {
        let read = stream
            .read(&mut byte)
            .await
            .map_err(|err| format!("Proxy closed the connection: {err}"))?;
        if read == 0 {
            return Err("Proxy closed the connection during CONNECT.".to_string());
        }
        response.push(byte[0]);
        if response.len() > 8192 {
            return Err("Proxy sent an oversized CONNECT response.".to_string());
        }
    }

    let head = String::from_utf8_lossy(&response);
    let status = head.lines().next().unwrap_or_default();
    if !status.contains(" 200") {
        return Err(format!("Proxy refused the CONNECT tunnel: {status}"));
    }

    Ok(())
}

fn tls_connector() -> Connector {
    let roots = rustls::RootCertStore {
        roots: webpki_roots::TLS_SERVER_ROOTS.to_vec(),
    };
    let config = rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    Connector::Rustls(Arc::new(config))
}

/// Synthesize `text` and return the encoded audio.
pub async fn synthesize(
    config: &SpeechConfig,
    text: &str,
    proxy: Option<&str>,
) -> Result<Vec<u8>, String> {
    let url = format!(
        "wss://{HOST}{WSS_PATH}?TrustedClientToken={TRUSTED_CLIENT_TOKEN}&ConnectionId={}&Sec-MS-GEC={}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}",
        uuid::Uuid::new_v4().simple(),
        sec_ms_gec(),
    );

    let mut request = url
        .into_client_request()
        .map_err(|err| format!("Failed to build the Edge TTS request: {err}"))?;
    {
        let headers = request.headers_mut();
        headers.insert(header::PRAGMA, "no-cache".parse().unwrap());
        headers.insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());
        headers.insert(header::USER_AGENT, USER_AGENT.parse().unwrap());
        headers.insert(header::ORIGIN, ORIGIN.parse().unwrap());
    }

    let transport = open_transport(proxy).await?;
    let (mut socket, _) = tokio_tungstenite::client_async_tls_with_config(
        request,
        transport,
        None,
        Some(tls_connector()),
    )
    .await
    .map_err(|err| format!("Edge TTS refused the connection: {err}"))?;

    socket
        .send(config_message(config))
        .await
        .map_err(|err| format!("Failed to send the Edge TTS configuration: {err}"))?;
    socket
        .send(ssml_message(text, config))
        .await
        .map_err(|err| format!("Failed to send the Edge TTS request: {err}"))?;

    let mut audio = Vec::new();
    // Binary frames only carry audio once the service has acknowledged the
    // turn; anything before that is protocol chatter with no payload.
    let mut streaming = false;

    while let Some(message) = socket.next().await {
        let message = message.map_err(|err| format!("Edge TTS connection failed: {err}"))?;

        match message {
            Message::Text(text) => {
                if text.contains("turn.start") || text.contains("Path:response") {
                    streaming = true;
                } else if text.contains("turn.end") {
                    break;
                }
            }
            Message::Binary(bytes) => {
                if !streaming || bytes.len() < 2 {
                    continue;
                }
                // Each frame is a big-endian header length, the header itself,
                // then the audio.
                let header_len = u16::from_be_bytes([bytes[0], bytes[1]]) as usize;
                let start = header_len + 2;
                if start <= bytes.len() {
                    audio.extend_from_slice(&bytes[start..]);
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    let _ = socket.close(None).await;

    if audio.is_empty() {
        return Err("Edge TTS returned no audio.".to_string());
    }

    Ok(audio)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_bare_host_and_port_as_http() {
        let url = url_parts("127.0.0.1:7890").unwrap();
        assert_eq!(url.scheme, "http");
        assert_eq!(url.authority, "127.0.0.1:7890");
        assert!(url.credentials.is_none());
    }

    #[test]
    fn parses_scheme_and_credentials() {
        let url = url_parts("socks5://alice:secret@proxy.local:1080").unwrap();
        assert_eq!(url.scheme, "socks5");
        assert_eq!(url.authority, "proxy.local:1080");
        assert_eq!(url.credentials.as_deref(), Some("alice:secret"));
    }

    #[test]
    fn a_password_containing_an_at_sign_keeps_the_last_separator() {
        let url = url_parts("http://user:p@ss@host:8000").unwrap();
        assert_eq!(url.authority, "host:8000");
        assert_eq!(url.credentials.as_deref(), Some("user:p@ss"));
    }

    #[test]
    fn rejects_an_address_without_a_port() {
        assert!(url_parts("http://127.0.0.1").is_err());
    }

    #[test]
    fn escapes_xml_significant_characters() {
        assert_eq!(escape_xml("a & b < c"), "a &amp; b &lt; c");
    }

    #[test]
    fn the_token_is_a_stable_uppercase_sha256() {
        let token = sec_ms_gec();
        assert_eq!(token.len(), 64);
        assert!(token.chars().all(|c| c.is_ascii_hexdigit() && !c.is_lowercase()));
        // Snapped to a five minute window, so two calls agree.
        assert_eq!(token, sec_ms_gec());
    }
}
