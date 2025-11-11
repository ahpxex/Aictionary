use serde::Deserialize;

#[derive(Deserialize)]
pub struct QueryMetricPayload {
    pub word: String,
    pub count: u32,
    #[serde(rename = "lastQueriedAt")]
    pub last_queried_at: String,
}
