use tauri::Manager;

// Module declarations
mod audio_cache;
mod dictionary;
mod download;
mod export;
mod shortcuts;
#[cfg(desktop)]
mod tray;
mod tts;

#[tauri::command]
#[cfg(desktop)]
fn set_tray_visibility(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    if let Some(tray_icon) = app.tray_by_id(tray::TRAY_ID) {
        tray_icon
            .set_visible(visible)
            .map_err(|e| format!("Failed to update tray visibility: {e}"))?;
    }

    Ok(())
}

// No-op fallback on platforms without tray support so the frontend
// can still call the command without compile-time cfg gymnastics.
#[tauri::command]
#[cfg(not(desktop))]
fn set_tray_visibility(_app: tauri::AppHandle, _visible: bool) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    // MCP automation bridge for development tooling only; binds to
    // localhost so nothing is exposed on the network.
    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::WindowEvent;

                let handle = app.handle();

                // Initialize tray icon and menu.
                tray::init_tray(&handle)?;
                tray::register_menu_handler(&handle);

                // Prevent exiting the app when the main window is closed:
                // instead, hide the window so the app keeps running in the tray.
                if let Some(main_window) = handle.get_webview_window("main") {
                    let window_for_event = main_window.clone();
                    main_window.on_window_event(move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = window_for_event.hide();
                        }
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Dictionary commands
            dictionary::dictionary_query,
            dictionary::get_default_dictionary_path,
            dictionary::check_dictionary_cache_exists,
            dictionary::count_dictionary_entries,
            dictionary::dictionary_metadata,
            // Export commands
            export::export_learned_words,
            export::export_query_metrics,
            // Download commands
            download::download_file,
            download::extract_gzip,
            download::fetch_text_file,
            // Audio cache commands
            audio_cache::resolve_audio_cache_entry,
            audio_cache::read_audio_cache_file,
            // TTS commands
            tts::start_tts_stream,
            tts::list_edge_voices,
            // Shortcuts commands
            shortcuts::setup_shortcuts,
            shortcuts::open_shortcut_permission_settings,
            // Tray commands
            set_tray_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
