#[cfg(desktop)]
use tauri::Manager;

// Module declarations
mod audio_cache;
mod dictionary;
mod download;
mod edge_tts;
mod export;
mod net;
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
    // rustls will not guess a CryptoProvider when the dependency graph offers
    // more than one, and the failure mode is a panic deep inside whichever
    // worker first builds a ClientConfig. Naming the provider up front makes
    // the choice deliberate and survives a dependency adding a second one.
    // Failure here only means someone else installed one first.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let builder = tauri::Builder::default();

    // MCP automation bridge for development tooling only; binds to
    // localhost so nothing is exposed on the network.
    #[cfg(all(debug_assertions, desktop))]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    let builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Global shortcuts, autostart and single-instance arbitration are desktop
    // window-manager concepts; the mobile platforms have no equivalent and the
    // plugins are not built for them.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));

    builder
        .setup(|_app| {
            #[cfg(desktop)]
            {
                use tauri::WindowEvent;

                let handle = _app.handle();

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
            dictionary::dictionary_reverse_query,
            dictionary::warm_reverse_index,
            dictionary::upsert_dictionary_entry,
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
