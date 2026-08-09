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
        proxies
            .find(&CFString::new(key))
            .map(|value| value.clone())
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

#[cfg(not(target_os = "macos"))]
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
        ProxyMode::Auto => from_env().or_else(from_system),
    }
}

/// A reqwest client that respects an explicitly configured proxy.
///
/// Left alone, reqwest already reads the environment and the system pane, so
/// only `Manual` and `Direct` have anything to add - and `Direct` has to say so
/// out loud, or reqwest would keep using the platform's proxy after the user
/// asked for a direct connection.
pub fn http_client(mode: ProxyMode, manual: Option<&str>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder();

    match mode {
        ProxyMode::Auto => {}
        ProxyMode::Direct => builder = builder.no_proxy(),
        ProxyMode::Manual => {
            builder = builder.no_proxy();
            if let Some(url) = resolve_proxy(mode, manual) {
                let proxy = reqwest::Proxy::all(&url)
                    .map_err(|err| format!("Invalid proxy address '{url}': {err}"))?;
                builder = builder.proxy(proxy);
            }
        }
    }

    builder
        .build()
        .map_err(|err| format!("Failed to build HTTP client: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direct_ignores_everything() {
        assert_eq!(resolve_proxy(ProxyMode::Direct, Some("http://p:1")), None);
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
