use serde::Serialize;
use tauri::{AppHandle, Runtime};
#[cfg(desktop)]
use tauri::Emitter;
#[cfg(desktop)]
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Map one stored modifier token onto what the hotkey parser expects.
///
/// Settings persist portable tokens so a config stays meaningful across
/// platforms: `Mod` is the platform's primary accelerator (Command on macOS,
/// Control elsewhere), while `Ctrl` and `Super` always mean the literal keys.
#[cfg(desktop)]
fn normalize_token(token: &str) -> String {
    match token.to_ascii_lowercase().as_str() {
        "mod" => if cfg!(target_os = "macos") {
            "Command"
        } else {
            "Control"
        }
        .to_string(),
        "ctrl" | "control" => "Control".to_string(),
        "super" | "meta" | "cmd" | "command" => if cfg!(target_os = "macos") {
            "Command"
        } else {
            "Super"
        }
        .to_string(),
        "alt" | "option" => "Alt".to_string(),
        "shift" => "Shift".to_string(),
        // An empty segment is what "Mod+ " (a space binding) splits into.
        "" => "Space".to_string(),
        _ => token.to_string(),
    }
}

/// Normalize a stored accelerator such as `Mod+Shift+K` into the
/// platform-specific form the global shortcut plugin can parse.
#[cfg(desktop)]
fn normalize_shortcut(shortcut: &str) -> String {
    shortcut
        .split('+')
        .map(|part| normalize_token(part.trim()))
        .collect::<Vec<_>>()
        .join("+")
}

/// Why a synthetic copy did not happen.
///
/// macOS needs both Automation (Apple Events) and Accessibility consent
/// before it lets us press Command+C inside another app. The two denials are
/// indistinguishable from the outside, so both map to `PermissionDenied` and
/// the UI points at the one settings pane that fixes either.
#[cfg(desktop)]
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CopyFailure {
    PermissionDenied,
    Unavailable,
}

/// Best-effort simulation of a copy shortcut (`Cmd+C` / `Ctrl+C`) in the
/// currently active application so that the user's selection is placed
/// on the clipboard before we read it.
#[cfg(desktop)]
fn simulate_copy_shortcut() -> Result<(), CopyFailure> {
    // macOS: use AppleScript to send Command+C to the frontmost app.
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(r#"tell application "System Events" to keystroke "c" using {command down}"#)
            .output()
            .map_err(|_| CopyFailure::Unavailable)?;

        if output.status.success() {
            return Ok(());
        }

        // -1743 is "not authorised to send Apple events", -1719 is the
        // assistive-access refusal; both mean the user has to grant consent.
        let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
        if stderr.contains("-1743")
            || stderr.contains("-1719")
            || stderr.contains("not allowed")
            || stderr.contains("not authorized")
            || stderr.contains("assistive")
        {
            return Err(CopyFailure::PermissionDenied);
        }

        Err(CopyFailure::Unavailable)
    }

    // Windows: use PowerShell + WScript.Shell to send Ctrl+C.
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let output = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                r#"$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('^c')"#,
            ])
            .output()
            .map_err(|_| CopyFailure::Unavailable)?;

        if output.status.success() {
            Ok(())
        } else {
            Err(CopyFailure::Unavailable)
        }
    }

    // Linux / other Unix: rely on xdotool if available.
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        use std::process::Command;

        let output = Command::new("xdotool")
            .args(["key", "ctrl+c"])
            .output()
            .map_err(|_| CopyFailure::Unavailable)?;

        if output.status.success() {
            Ok(())
        } else {
            Err(CopyFailure::Unavailable)
        }
    }
}

/// What the frontend receives when the quick query shortcut fires.
///
/// The window is raised either way; the payload only decides whether a
/// lookup runs or the user gets told why nothing was picked up.
#[cfg(desktop)]
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickQueryPayload {
    /// The text to look up, absent when the clipboard held nothing usable.
    text: Option<String>,
    /// Set when the synthetic copy failed, so the UI can explain itself.
    copy_error: Option<CopyFailure>,
}

/// Per-shortcut registration outcome. Registration is attempted for both
/// bindings independently so one bad accelerator cannot silently disable the
/// other, and failures travel back to the UI instead of dying in a log line.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutSetupReport {
    quick_query_error: Option<String>,
    new_query_error: Option<String>,
    popup_query_error: Option<String>,
}

#[cfg(desktop)]
#[tauri::command]
pub async fn setup_shortcuts<R: Runtime>(
    app: AppHandle<R>,
    quick_query: String,
    new_query: String,
    popup_query: String,
    enabled: bool,
) -> Result<ShortcutSetupReport, String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcuts = app.global_shortcut();

    // Unregister all existing shortcuts first
    shortcuts
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {}", e))?;

    let mut report = ShortcutSetupReport::default();

    if !enabled {
        return Ok(report);
    }

    // Register quick query shortcut (copy selected text + show window + search)
    match normalize_shortcut(&quick_query).parse::<Shortcut>() {
        Ok(shortcut) => {
            let app_handle = app.clone();
            let registration = shortcuts.on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }

                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // Push the active app's selection onto the clipboard.
                    // The helper shells out, so keep it off the async worker.
                    let copy_error = tauri::async_runtime::spawn_blocking(simulate_copy_shortcut)
                        .await
                        .unwrap_or(Err(CopyFailure::Unavailable))
                        .err();

                    // Give the pasteboard a moment to settle.
                    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

                    let text = app_handle
                        .clipboard()
                        .read_text()
                        .ok()
                        .filter(|value| !value.trim().is_empty());

                    // Always surface the window: a silent no-op is
                    // indistinguishable from the shortcut not working at all.
                    crate::tray::focus_window(&app_handle, "main");

                    let _ = app_handle.emit("quick-query", QuickQueryPayload { text, copy_error });
                });
            });

            if let Err(error) = registration {
                report.quick_query_error = Some(error.to_string());
            }
        }
        Err(error) => {
            report.quick_query_error = Some(error.to_string());
        }
    }

    // Register new query shortcut (show window + focus search box)
    match normalize_shortcut(&new_query).parse::<Shortcut>() {
        Ok(shortcut) => {
            let app_handle = app.clone();
            let registration = shortcuts.on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }

                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    crate::tray::focus_window(&app_handle, "main");
                    let _ = app_handle.emit("new-query", ());
                });
            });

            if let Err(error) = registration {
                report.new_query_error = Some(error.to_string());
            }
        }
        Err(error) => {
            report.new_query_error = Some(error.to_string());
        }
    }

    // Register the Popup toggle. It deliberately reuses the Tray's native
    // show/hide path so the shortcut behaves exactly like a Tray click.
    match normalize_shortcut(&popup_query).parse::<Shortcut>() {
        Ok(shortcut) => {
            let app_handle = app.clone();
            let registration = shortcuts.on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }

                crate::tray::toggle_popup(&app_handle, None);
            });

            if let Err(error) = registration {
                report.popup_query_error = Some(error.to_string());
            }
        }
        Err(error) => {
            report.popup_query_error = Some(error.to_string());
        }
    }

    Ok(report)
}

/// Mobile has no system-wide hotkey registry, so there is nothing to bind.
/// The command still exists — the settings screen calls it unconditionally —
/// and reports success with an empty error report.
#[cfg(mobile)]
#[tauri::command]
pub async fn setup_shortcuts<R: Runtime>(
    _app: AppHandle<R>,
    _quick_query: String,
    _new_query: String,
    _popup_query: String,
    _enabled: bool,
) -> Result<ShortcutSetupReport, String> {
    Ok(ShortcutSetupReport::default())
}

/// Open the OS pane where the user grants the consent the quick query
/// shortcut needs. Only macOS gates synthetic keystrokes this way.
#[tauri::command]
pub fn open_shortcut_permission_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")
            .status()
            .map_err(|err| err.to_string())?;

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    Ok(())
}

#[cfg(all(test, desktop))]
mod tests {
    use super::normalize_shortcut;

    #[test]
    fn maps_mod_to_the_platform_accelerator() {
        let expected = if cfg!(target_os = "macos") {
            "Command+Shift+K"
        } else {
            "Control+Shift+K"
        };
        assert_eq!(normalize_shortcut("Mod+Shift+K"), expected);
    }

    #[test]
    fn keeps_literal_control_distinct_from_mod() {
        assert_eq!(normalize_shortcut("Ctrl+Shift+K"), "Control+Shift+K");
    }

    #[test]
    fn normalizes_a_trailing_space_segment() {
        assert_eq!(
            normalize_shortcut("Mod+ "),
            if cfg!(target_os = "macos") {
                "Command+Space"
            } else {
                "Control+Space"
            }
        );
    }

    #[test]
    fn leaves_plain_keys_alone() {
        assert_eq!(normalize_shortcut("Alt+Enter"), "Alt+Enter");
    }
}
