import { invoke } from "@tauri-apps/api/core";
import { WordDefinition } from "@/shared/types/dictionary";

export async function queryDictionary(
  word: string,
  cachePath: string
): Promise<WordDefinition> {
  const trimmed = word.trim();
  if (!trimmed) {
    throw new Error("Word is required");
  }

  try {
    const result = await invoke<WordDefinition>("dictionary_query", {
      word: trimmed,
      cache_path: cachePath,
      cachePath,
    });
    return result;
  } catch (error) {
    console.warn("Falling back to mock dictionary data:", error);
    return {
      word,
      pronunciation: "placeholder",
      concise_definition: `Definition for ${word} is not available yet.`,
      forms: {
        third_person_singular: `${word}s`,
        past_tense: `${word}ed`,
        past_participle: `${word}ed`,
        present_participle: `${word}ing`,
      },
      definitions: [
        {
          pos: "verb",
          explanation_en:
            "This is a placeholder definition. Configure the dictionary provider to retrieve real data.",
          explanation_cn: "这是临时释义。在配置词典服务后会返回真实数据。",
          example_en: `You queried ${word}, but the real explanation will appear once the provider is ready.`,
          example_cn: `你查询了 ${word}，但在配置词典服务后会显示真实的释义。`,
        },
      ],
      comparison: [],
    };
  }
}
