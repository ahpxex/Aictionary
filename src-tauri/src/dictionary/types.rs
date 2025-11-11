use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Serialize, Deserialize, Clone)]
pub struct DefinitionEntry {
    pub pos: String,
    pub explanation_en: String,
    pub explanation_cn: String,
    pub example_en: String,
    pub example_cn: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ComparisonEntry {
    #[serde(default)]
    pub word_to_compare: String,
    #[serde(default)]
    pub analysis: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WordDefinition {
    pub word: String,
    pub pronunciation: String,
    pub concise_definition: String,
    #[serde(default, deserialize_with = "deserialize_forms")]
    pub forms: BTreeMap<String, String>,
    #[serde(default)]
    pub definitions: Vec<DefinitionEntry>,
    #[serde(default)]
    pub comparison: Vec<ComparisonEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertDictionaryEntryArgs {
    pub cache_path: String,
    pub entry: WordDefinition,
}

fn deserialize_forms<'de, D>(deserializer: D) -> Result<BTreeMap<String, String>, D::Error>
where
    D: Deserializer<'de>,
{
    let raw = Option::<BTreeMap<String, Value>>::deserialize(deserializer)?
        .unwrap_or_default();

    Ok(raw
        .into_iter()
        .map(|(key, value)| (key, value_to_string(value)))
        .collect())
}

fn value_to_string(value: Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(b) => b.to_string(),
        Value::Number(num) => num.to_string(),
        Value::String(s) => s,
        Value::Array(items) => items
            .into_iter()
            .map(value_to_string)
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => "[object]".into(),
    }
}
