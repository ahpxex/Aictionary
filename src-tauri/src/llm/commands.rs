use super::types::TestLlmProviderArgs;

/// Test LLM provider configuration.
/// Validates that required fields are present.
/// In a production app, this would make an actual API call to verify connectivity.
#[tauri::command]
pub fn test_llm_provider(args: TestLlmProviderArgs) -> Result<(), String> {
    if args.base_url.trim().is_empty() {
        return Err("Base URL is required.".into());
    }

    if args.api_key.trim().is_empty() {
        return Err("API key is required.".into());
    }

    if args.model.trim().is_empty() {
        return Err("Model is required.".into());
    }

    // In lieu of a real call, we just simulate a connectivity check.
    Ok(())
}
