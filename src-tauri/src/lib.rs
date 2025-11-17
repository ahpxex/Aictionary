// Module declarations
mod dictionary;
mod download;
mod export;
mod llm;
mod shortcuts;
#[cfg(all(desktop, feature = "tray-icon"))]
mod tray;

#[tauri::command]
#[cfg(all(desktop, feature = "tray-icon"))]
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
#[cfg(not(all(desktop, feature = "tray-icon")))]
fn set_tray_visibility(_app: tauri::AppHandle, _visible: bool) -> Result<(), String> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .setup(|app| {
            #[cfg(all(desktop, feature = "tray-icon"))]
            {
                let handle = app.handle();
                tray::init_tray(&handle)?;
                tray::register_menu_handler(&handle);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Dictionary commands
            dictionary::dictionary_query,
            dictionary::upsert_dictionary_entry,
            dictionary::get_default_dictionary_path,
            dictionary::check_dictionary_cache_exists,
            dictionary::count_dictionary_entries,
            // LLM commands
            llm::test_llm_provider,
            // Export commands
            export::export_learned_words,
            export::export_query_metrics,
            // Download commands
            download::download_file,
            download::extract_zip,
            // Shortcuts commands
            shortcuts::setup_shortcuts,
            // Tray commands
            set_tray_visibility,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
