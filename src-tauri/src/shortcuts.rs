use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub async fn setup_shortcuts<R: Runtime>(
    app: AppHandle<R>,
    quick_query: String,
    new_query: String,
) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    let shortcuts = app.global_shortcut();

    // Unregister all existing shortcuts first
    shortcuts
        .unregister_all()
        .map_err(|e| format!("Failed to unregister shortcuts: {}", e))?;

    // Register quick query shortcut (copy selected text + show window + search)
    let app_handle = app.clone();
    shortcuts
        .on_shortcut(&quick_query, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    // Simulate Ctrl+C / Cmd+C to copy selected text
                    #[cfg(target_os = "macos")]
                    let copy_shortcut = "Cmd+C";
                    #[cfg(not(target_os = "macos"))]
                    let copy_shortcut = "Ctrl+C";

                    // Trigger copy command in the system
                    if let Ok(global_shortcut) = app_handle.try_global_shortcut() {
                        // We can't directly simulate keypresses, so we'll read from clipboard after a small delay
                        // The user should have already selected text, so we just read it
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

                        if let Ok(clipboard_text) = app_handle.clipboard().read_text() {
                            if let Some(text) = clipboard_text {
                                if !text.trim().is_empty() {
                                    // Show the main window
                                    if let Some(window) = app_handle.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                        let _ = window.unminimize();

                                        // Emit event to frontend with the clipboard text
                                        let _ = app_handle.emit("quick-query", text);
                                    }
                                }
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
        .on_shortcut(&new_query, move |_app, _shortcut, event| {
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
