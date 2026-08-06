use serde::{Deserialize, Serialize};
use serde_json::Value;

/// A successful dictionary lookup. `entry` is a full
/// `distribution_entry_v5` document; `source` records whether it came from
/// the distributed dictionary database or from the user's own entries.
#[derive(Serialize, Debug)]
pub struct DictionaryLookupResult {
    pub source: LookupSource,
    pub entry: Value,
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum LookupSource {
    Dictionary,
    User,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertDictionaryEntryArgs {
    pub cache_path: String,
    /// A `distribution_entry_v5`-shaped document produced by the app's LLM
    /// generation flow. Stored verbatim; only `headword` is required here.
    pub entry: Value,
}
