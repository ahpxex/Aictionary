use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
struct WordForms {
    third_person_singular: String,
    past_tense: String,
    past_participle: String,
    present_participle: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct DefinitionEntry {
    pos: String,
    explanation_en: String,
    explanation_cn: String,
    example_en: String,
    example_cn: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ComparisonEntry {
    word_to_compare: String,
    analysis: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct WordDefinition {
    word: String,
    pronunciation: String,
    concise_definition: String,
    forms: WordForms,
    definitions: Vec<DefinitionEntry>,
    comparison: Vec<ComparisonEntry>,
}

fn sample_definition() -> WordDefinition {
    WordDefinition {
        word: "abandon".to_string(),
        pronunciation: "uh·bahn·duhn".to_string(),
        concise_definition: "v. 抛弃, 遗弃, 放弃, 中止".to_string(),
        forms: WordForms {
            third_person_singular: "abandons".to_string(),
            past_tense: "abandoned".to_string(),
            past_participle: "abandoned".to_string(),
            present_participle: "abandoning".to_string(),
        },
        definitions: vec![
            DefinitionEntry {
                pos: "verb".to_string(),
                explanation_en: "To leave something or someone permanently, often in a way that shows a lack of care or responsibility, especially when it is expected to be cared for.".to_string(),
                explanation_cn: "指永久性地离开某物或某人，通常表现出缺乏关心或责任感，尤其是在本应予以照顾的情况下。".to_string(),
                example_en: "The crew had to abandon the sinking ship.".to_string(),
                example_cn: "船员不得不弃船逃生。".to_string(),
            },
            DefinitionEntry {
                pos: "verb".to_string(),
                explanation_en: "To give up on a plan, activity, or effort completely, often due to difficulty, discouragement, or changing priorities.".to_string(),
                explanation_cn: "指完全放弃某个计划、活动或努力，通常是因为困难、气馁或优先事项改变。".to_string(),
                example_en: "She abandoned her dream of becoming a professional dancer after the injury.".to_string(),
                example_cn: "受伤后，她放弃了成为职业舞者的梦想。".to_string(),
            },
            DefinitionEntry {
                pos: "verb".to_string(),
                explanation_en: "To surrender control or restraint over oneself, often in the context of emotions or behavior, leading to unrestrained expression.".to_string(),
                explanation_cn: "指放任自己，不再克制，常用于描述情绪或行为的彻底释放。".to_string(),
                example_en: "He abandoned himself to laughter at the funny movie.".to_string(),
                example_cn: "他被这部搞笑电影逗得开怀大笑。".to_string(),
            },
        ],
        comparison: vec![
            ComparisonEntry {
                word_to_compare: "desert".to_string(),
                analysis: "“Desert” (遗弃) 通常指在军事、责任或义务背景下故意离开，带有道德谴责意味，常用于人或职责（如士兵临阵脱逃）。而 “abandon” 更广泛，可指对物、计划或情感的放弃，不一定涉及道德判断。".to_string(),
            },
            ComparisonEntry {
                word_to_compare: "forsake".to_string(),
                analysis: "“Forsake” (舍弃) 是一个更正式、文学化的词，常用于情感或精神层面的割舍，如“forsake sin”（弃绝罪恶），带有强烈的牺牲或决绝意味。而 “abandon” 更口语化，强调行为上的彻底离开，情感色彩较弱。".to_string(),
            },
            ComparisonEntry {
                word_to_compare: "give up".to_string(),
                analysis: "“Give up” (放弃) 是 “abandon” 的非正式同义表达，常用于日常语境，语气较轻，多用于习惯、努力或目标的停止（如 give up smoking）。而 “abandon” 更强烈，常暗示彻底、不可逆转的丢弃，带有更重的情感或后果。".to_string(),
            },
        ],
    }
}

fn placeholder_definition(word: &str) -> WordDefinition {
    WordDefinition {
        word: word.to_string(),
        pronunciation: "placeholder".to_string(),
        concise_definition: format!("Definition for {word} is not available yet."),
        forms: WordForms {
            third_person_singular: format!("{word}s"),
            past_tense: format!("{word}ed"),
            past_participle: format!("{word}ed"),
            present_participle: format!("{word}ing"),
        },
        definitions: vec![DefinitionEntry {
            pos: "verb".to_string(),
            explanation_en: "This is a placeholder definition. Configure the dictionary provider to retrieve real data.".to_string(),
            explanation_cn: "这是临时释义。在配置词典服务后会返回真实数据。".to_string(),
            example_en: format!("You queried {word}, but the real explanation will appear once the provider is ready."),
            example_cn: format!("你查询了 {word}，但在配置词典服务后会显示真实的释义。"),
        }],
        comparison: Vec::new(),
    }
}

#[tauri::command]
fn dictionary_query(word: &str) -> Result<WordDefinition, String> {
    if word.trim().is_empty() {
        return Err("Word is required".into());
    }

    if word.eq_ignore_ascii_case("abandon") {
        Ok(sample_definition())
    } else {
        Ok(placeholder_definition(word))
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RefreshDictionaryArgs {
    cache_path: Option<String>,
}

#[tauri::command]
fn refresh_dictionary_cache(args: RefreshDictionaryArgs) -> Result<(), String> {
    if let Some(path) = args.cache_path {
        if path.trim().is_empty() {
            return Err("Cache path cannot be empty.".into());
        }

        let dir = PathBuf::from(path);
        if !dir.exists() {
            fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestLlmProviderArgs {
    base_url: String,
    api_key: String,
    model: String,
}

#[tauri::command]
fn test_llm_provider(args: TestLlmProviderArgs) -> Result<(), String> {
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

#[derive(Deserialize)]
struct QueryMetricPayload {
    word: String,
    count: u32,
    #[serde(rename = "lastQueriedAt")]
    last_queried_at: String,
}

fn write_to_downloads(app: &tauri::AppHandle, filename: &str, content: String) -> Result<PathBuf, String> {
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|err| err.to_string())?;
    let file_path = download_dir.join(filename);
    fs::write(&file_path, content).map_err(|err| err.to_string())?;
    Ok(file_path)
}

#[tauri::command]
fn export_learned_words(app: tauri::AppHandle, words: Vec<String>) -> Result<String, String> {
    if words.is_empty() {
        return Err("No words to export.".into());
    }

    let content = words.join("\n");
    let file_path = write_to_downloads(&app, "aictionary_learned_words.txt", content)?;
    Ok(file_path.to_string_lossy().into())
}

#[tauri::command]
fn export_query_metrics(app: tauri::AppHandle, metrics: Vec<QueryMetricPayload>) -> Result<String, String> {
    if metrics.is_empty() {
        return Err("No metrics to export.".into());
    }

    let mut content = String::new();
    for metric in metrics {
        let line = format!(
            "{} - {} times (last queried {})\n",
            metric.word, metric.count, metric.last_queried_at
        );
        content.push_str(&line);
    }

    let file_path = write_to_downloads(&app, "aictionary_query_metrics.txt", content)?;
    Ok(file_path.to_string_lossy().into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            dictionary_query,
            refresh_dictionary_cache,
            test_llm_provider,
            export_learned_words,
            export_query_metrics
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
