use serde::Serialize;
use serde_json::Value;

/// A successful dictionary lookup. `entry` is a full `distribution_entry_v5`
/// document taken verbatim from the distributed dictionary database, which is
/// the app's only source of entries.
#[derive(Serialize, Debug)]
pub struct DictionaryLookupResult {
    pub entry: Value,
}
