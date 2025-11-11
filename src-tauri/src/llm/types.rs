use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestLlmProviderArgs {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}
