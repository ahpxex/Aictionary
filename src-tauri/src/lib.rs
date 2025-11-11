// Module declarations
mod dictionary;
mod download;
mod export;
mod llm;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Dictionary commands
            dictionary::dictionary_query,
            dictionary::upsert_dictionary_entry,
            dictionary::get_default_dictionary_path,
            dictionary::check_dictionary_cache_exists,
            // LLM commands
            llm::test_llm_provider,
            // Export commands
            export::export_learned_words,
            export::export_query_metrics,
            // Download commands
            download::download_file,
            download::extract_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
