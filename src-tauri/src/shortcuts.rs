use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Convert "Mod" to platform-specific modifier key and normalize special keys
fn normalize_shortcut(shortcut: &str) -> String {
    // First replace "Mod" with platform-specific key
    #[cfg(target_os = "macos")]
    let mut normalized = shortcut.replace("Mod", "Command");

    #[cfg(not(target_os = "macos"))]
    let mut normalized = shortcut.replace("Mod", "Control");

    // Handle space key - replace " " at the end or standalone with "Space"
    // Split by + to handle each part
    let parts: Vec<&str> = normalized.split('+').collect();
    let normalized_parts: Vec<String> = parts
        .iter()
        .map(|part| {
            let trimmed = part.trim();
            if trimmed.is_empty() || trimmed == " " {
                "Space".to_string()
            } else {
                trimmed.to_string()
            }
        })
        .collect();

    normalized_parts.join("+")
}

#[tauri::command]
pub async fn setup_shortcuts<R: Runtime>(
    app: AppHandle<R>,
    quick_query: String,
    new_query: String,
) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState, Shortcut};

    let shortcuts = app.global_shortcut();

    // Unregister all existing shortcuts first
    shortcuts
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {}", e))?;

    // Normalize shortcuts to replace "Mod" with platform-specific key
    let quick_query_normalized = normalize_shortcut(&quick_query);
    let new_query_normalized = normalize_shortcut(&new_query);

    // Parse shortcuts
    let quick_query_shortcut: Shortcut = quick_query_normalized
        .parse()
        .map_err(|e| format!("Failed to parse quick query shortcut '{}': {}", quick_query_normalized, e))?;

    let new_query_shortcut: Shortcut = new_query_normalized
        .parse()
        .map_err(|e| format!("Failed to parse new query shortcut '{}': {}", new_query_normalized, e))?;

    // Register quick query shortcut (copy selected text + show window + search)
    let app_handle = app.clone();
    shortcuts
        .on_shortcut(quick_query_shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // Read from clipboard
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                    if let Ok(clipboard_text) = app_handle.clipboard().read_text() {
                        if !clipboard_text.trim().is_empty() {
                            // Show the main window
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();

                                // Emit event to frontend with the clipboard text
                                let _ = app_handle.emit("quick-query", clipboard_text);
                            }
                        }
                    }
                });
            }
        })
        .map_err(|e| format!("Failed to register quick query shortcut: {}", e))?;

    // Register new query shortcut (show window + focus search box)
    let app_handle = app.clone();
    shortcuts
        .on_shortcut(new_query_shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // Show the main window and focus it
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();

                        // Emit event to frontend to focus search box
                        let _ = app_handle.emit("new-query", ());
                    }
                });
            }
        })
        .map_err(|e| format!("Failed to register new query shortcut: {}", e))?;

    Ok(())
}
