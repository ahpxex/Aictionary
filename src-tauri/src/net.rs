//! Where the app's outbound connections learn about a proxy.
//!
//! Most of the networking here runs on reqwest, which finds a proxy by itself,
//! so this module would be unnecessary if Edge TTS were an HTTP client too. It
//! is not: `msedge-tts` opens a raw `TcpStream` to the endpoint, which means it
//! ignores the environment and the platform's proxy pane alike. On a network
//! that refuses a direct connection to the read-aloud websocket - the reset is
//! specific to the upgrade, plain HTTPS to the same host is untouched - the
//! keyless default provider is simply dead until it is told where to go.
//!
//! Android sharpens the point. There is no proxy environment variable to
//! inherit and no system pane to read, so an explicit setting is the only way
//! a phone can reach the service at all.

use serde::Deserialize;

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NetworkSettings {
    pub proxy_mode: ProxyMode,
    pub proxy_url: String,
    pub custom_ca_pem: String,
}

pub fn custom_certificates(
    pem: &str,
) -> Result<Vec<rustls::pki_types::CertificateDer<'static>>, String> {
    use rustls::pki_types::pem::PemObject;
    if pem.trim().is_empty() {
        return Ok(vec![]);
    }
    if pem.len() > 128 * 1024 || pem.contains("PRIVATE KEY") {
        return Err(
            "Provide a PEM CA certificate bundle, without private keys (maximum 128 KB).".into(),
        );
    }
    let certs = rustls::pki_types::CertificateDer::pem_slice_iter(pem.as_bytes())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Invalid CA certificate: {e}"))?;
    if certs.is_empty() {
        return Err("No PEM certificates found.".into());
    }
    let mut roots = rustls::RootCertStore::empty();
    for cert in &certs {
        roots
            .add(cert.clone())
            .map_err(|e| format!("Invalid CA certificate: {e}"))?;
    }
    Ok(certs)
}

#[tauri::command]
pub fn validate_custom_ca(pem: String) -> Result<(), String> {
    custom_certificates(&pem).map(|_| ())
}

pub fn tls_config(pem: &str) -> Result<rustls::ClientConfig, String> {
    let mut roots = rustls::RootCertStore {
        roots: webpki_roots::TLS_SERVER_ROOTS.to_vec(),
    };
    for cert in custom_certificates(pem)? {
        roots
            .add(cert)
            .map_err(|e| format!("Invalid CA certificate: {e}"))?;
    }
    Ok(rustls::ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth())
}

/// Where the proxy address comes from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProxyMode {
    /// Follow the platform: proxy environment variables, then the system pane.
    #[default]
    Auto,
    /// Use the address the user typed, whatever the platform says.
    Manual,
    /// Connect directly even if the platform advertises a proxy.
    Direct,
}

/// The proxy environment variables, most specific first. HTTPS leads because
/// every endpoint here is TLS; `all_proxy` outranks `http_proxy` because it is
/// the broader statement of intent.
const ENV_VARS: [&str; 6] = [
    "https_proxy",
    "HTTPS_PROXY",
    "all_proxy",
    "ALL_PROXY",
    "http_proxy",
    "HTTP_PROXY",
];

fn from_env() -> Option<String> {
    ENV_VARS.iter().find_map(|name| {
        std::env::var(name)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    })
}

/// The macOS network pane. A packaged app launched from Finder inherits no
/// shell environment, so for most users this - not `https_proxy` - is where a
/// configured proxy actually lives.
#[cfg(target_os = "macos")]
fn from_system() -> Option<String> {
    use system_configuration::core_foundation::base::CFType;
    use system_configuration::core_foundation::number::CFNumber;
    use system_configuration::core_foundation::string::CFString;
    use system_configuration::dynamic_store::SCDynamicStoreBuilder;

    let store = SCDynamicStoreBuilder::new("aictionary-proxy-lookup").build()?;
    let proxies = store.get_proxies()?;

    let lookup = |key: &str| -> Option<CFType> {
        proxies.find(&CFString::new(key)).map(|value| value.clone())
    };
    let enabled = |key: &str| -> bool {
        lookup(key)
            .and_then(|value| value.downcast::<CFNumber>().and_then(|n| n.to_i32()))
            .unwrap_or(0)
            == 1
    };
    let text = |key: &str| -> Option<String> {
        lookup(key).and_then(|value| value.downcast::<CFString>().map(|s| s.to_string()))
    };
    let port = |key: &str| -> Option<i32> {
        lookup(key).and_then(|value| value.downcast::<CFNumber>().and_then(|n| n.to_i32()))
    };

    // SOCKS first: when a tunnel offers both, SOCKS carries the websocket
    // without the proxy having to understand an HTTP upgrade.
    for (scheme, enable_key, host_key, port_key) in [
        ("socks5", "SOCKSEnable", "SOCKSProxy", "SOCKSPort"),
        ("http", "HTTPSEnable", "HTTPSProxy", "HTTPSPort"),
        ("http", "HTTPEnable", "HTTPProxy", "HTTPPort"),
    ] {
        if !enabled(enable_key) {
            continue;
        }
        if let (Some(host), Some(port)) = (text(host_key), port(port_key)) {
            if !host.is_empty() {
                return Some(format!("{scheme}://{host}:{port}"));
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn from_system() -> Option<String> {
    let settings = windows_registry::CURRENT_USER
        .open("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings")
        .ok()?;
    if settings.get_u32("ProxyEnable").unwrap_or(0) == 0 {
        return None;
    }
    if settings
        .get_string("ProxyOverride")
        .ok()
        .is_some_and(|value| bypass_edge_proxy(&value))
    {
        return None;
    }
    windows_proxy_for_https(&settings.get_string("ProxyServer").ok()?)
}

#[cfg(any(target_os = "windows", test))]
fn windows_proxy_for_https(value: &str) -> Option<String> {
    let parts: Vec<_> = value
        .split(';')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .collect();
    let address = parts
        .iter()
        .find_map(|part| part.strip_prefix("https="))
        .or_else(|| parts.iter().find(|part| !part.contains('=')).copied())?;
    if address.is_empty() {
        return None;
    }
    Some(if address.contains("://") {
        address.to_string()
    } else {
        format!("http://{address}")
    })
}

fn bypass_edge_proxy(value: &str) -> bool {
    const HOST: &str = "speech.platform.bing.com";
    value.split([',', ';']).any(|part| {
        let part = part
            .trim()
            .trim_start_matches("*.")
            .trim_start_matches('.')
            .to_ascii_lowercase();
        part == "*" || part == HOST || (!part.is_empty() && HOST.ends_with(&format!(".{part}")))
    })
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn from_system() -> Option<String> {
    None
}

/// The proxy to dial for, or `None` to connect directly.
pub fn resolve_proxy(mode: ProxyMode, manual: Option<&str>) -> Option<String> {
    match mode {
        ProxyMode::Direct => None,
        ProxyMode::Manual => manual
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        ProxyMode::Auto => {
            if std::env::var("no_proxy")
                .or_else(|_| std::env::var("NO_PROXY"))
                .ok()
                .is_some_and(|value| bypass_edge_proxy(&value))
            {
                None
            } else {
                from_env().or_else(from_system)
            }
        }
    }
}

/// A reqwest client that respects an explicitly configured proxy.
///
/// Left alone, reqwest already reads the environment and the system pane, so
/// only `Manual` and `Direct` have anything to add - and `Direct` has to say so
/// out loud, or reqwest would keep using the platform's proxy after the user
/// asked for a direct connection.
pub fn http_client_builder(
    mode: ProxyMode,
    manual: Option<&str>,
    ca: &str,
) -> Result<reqwest::ClientBuilder, String> {
    let mut builder =
        reqwest::Client::builder().connect_timeout(std::time::Duration::from_secs(15));
    for cert in custom_certificates(ca)? {
        builder = builder.add_root_certificate(
            reqwest::Certificate::from_der(cert.as_ref()).map_err(|e| e.to_string())?,
        );
    }

    match mode {
        ProxyMode::Auto => {}
        ProxyMode::Direct => builder = builder.no_proxy(),
        ProxyMode::Manual => {
            builder = builder.no_proxy();
            if let Some(url) = resolve_proxy(mode, manual) {
                let proxy = reqwest::Proxy::all(&url)
                    .map_err(|_| "Invalid proxy address".to_string())?
                    .no_proxy(reqwest::NoProxy::from_string("localhost,127.0.0.1,::1"));
                builder = builder.proxy(proxy);
            }
        }
    }

    Ok(builder)
}

pub fn http_client(
    mode: ProxyMode,
    manual: Option<&str>,
    ca: &str,
) -> Result<reqwest::Client, String> {
    http_client_builder(mode, manual, ca)?
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn custom_ca_rejects_malformed_input_and_private_keys() {
        assert!(custom_certificates("not a certificate").is_err());
        assert!(custom_certificates(
            "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----"
        )
        .is_err());
        assert!(custom_certificates("-----BEGIN PRIVATE KEY-----").is_err());
        assert_eq!(
            custom_certificates(include_str!("../tests/fixtures/localhost-cert.pem"))
                .unwrap()
                .len(),
            1
        );
        assert!(custom_certificates("").unwrap().is_empty());
    }

    #[tokio::test]
    async fn custom_ca_enables_native_https_without_disabling_verification() {
        use rustls::pki_types::{pem::PemObject, CertificateDer, PrivateKeyDer};
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let _ = rustls::crypto::ring::default_provider().install_default();
        let mut params = rcgen::CertificateParams::new(vec!["localhost".into()]).unwrap();
        params.extended_key_usages = vec![rcgen::ExtendedKeyUsagePurpose::ServerAuth];
        params.not_before =
            (std::time::SystemTime::now() - std::time::Duration::from_secs(60)).into();
        params.not_after =
            (std::time::SystemTime::now() + std::time::Duration::from_secs(86400)).into();
        let key_pair = rcgen::KeyPair::generate().unwrap();
        let certificate = params.self_signed(&key_pair).unwrap();
        let pem = certificate.pem();
        let pem = pem.as_str();
        let key = PrivateKeyDer::from_pem_slice(key_pair.serialize_pem().as_bytes()).unwrap();
        let server_config = rustls::ServerConfig::builder()
            .with_no_client_auth()
            .with_single_cert(
                vec![CertificateDer::from_pem_slice(pem.as_bytes()).unwrap()],
                key,
            )
            .unwrap();
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let acceptor = tokio_rustls::TlsAcceptor::from(std::sync::Arc::new(server_config));
            for _ in 0..3 {
                let (stream, _) = listener.accept().await.unwrap();
                let Ok(mut stream) = acceptor.accept(stream).await else {
                    continue;
                };
                let mut buffer = [0; 4096];
                if stream.read(&mut buffer).await.unwrap_or(0) == 0 {
                    continue;
                }
                let _ = stream
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
                    )
                    .await;
            }
        });
        let url = format!("https://localhost:{}", address.port());
        assert!(http_client(ProxyMode::Direct, None, "")
            .unwrap()
            .get(&url)
            .send()
            .await
            .is_err());
        let trusted = http_client(ProxyMode::Direct, None, pem)
            .unwrap()
            .get(&url)
            .send()
            .await
            .unwrap();
        assert_eq!(trusted.text().await.unwrap(), "ok");
        // The websocket TLS config uses the same extra roots, and still checks names.
        let connector =
            tokio_rustls::TlsConnector::from(std::sync::Arc::new(tls_config(pem).unwrap()));
        let stream = tokio::net::TcpStream::connect(address).await.unwrap();
        assert!(connector
            .connect(
                rustls::pki_types::ServerName::try_from("wrong.invalid").unwrap(),
                stream
            )
            .await
            .is_err());
        server.await.unwrap();
    }

    #[test]
    fn direct_ignores_everything() {
        assert_eq!(resolve_proxy(ProxyMode::Direct, Some("http://p:1")), None);
    }

    #[test]
    fn windows_proxy_supports_shared_and_protocol_specific_addresses() {
        assert_eq!(
            windows_proxy_for_https("127.0.0.1:7890"),
            Some("http://127.0.0.1:7890".into())
        );
        assert_eq!(
            windows_proxy_for_https("http=one:80;https=two:81"),
            Some("http://two:81".into())
        );
        assert_eq!(windows_proxy_for_https("http=one:80"), None);
        assert!(bypass_edge_proxy("localhost;*.bing.com"));
        assert!(!bypass_edge_proxy("localhost,127.0.0.1"));
    }

    #[test]
    fn manual_uses_the_typed_address() {
        assert_eq!(
            resolve_proxy(ProxyMode::Manual, Some("  socks5://127.0.0.1:7890 ")),
            Some("socks5://127.0.0.1:7890".to_string())
        );
    }

    #[test]
    fn manual_without_an_address_is_direct() {
        assert_eq!(resolve_proxy(ProxyMode::Manual, Some("   ")), None);
        assert_eq!(resolve_proxy(ProxyMode::Manual, None), None);
    }

    #[test]
    fn mode_deserializes_from_the_settings_payload() {
        assert_eq!(
            serde_json::from_str::<ProxyMode>("\"manual\"").unwrap(),
            ProxyMode::Manual
        );
        assert_eq!(ProxyMode::default(), ProxyMode::Auto);
    }
}
