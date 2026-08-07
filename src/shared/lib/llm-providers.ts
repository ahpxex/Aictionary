/**
 * OpenAI-compatible endpoints worth offering by name.
 *
 * Every one of these speaks the same wire protocol, so the only thing that
 * actually differs is the base URL - which is exactly the part a user should
 * not have to look up. Anything not listed still works through `custom`.
 *
 * Each URL was checked against `/models` with a deliberately invalid key: a
 * 401/403 proves the path is right, a 404 would mean it is not.
 */
export type LlmProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
};

export const CUSTOM_PROVIDER_ID = "custom";

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "siliconflow",
    label: "SiliconFlow 硅基流动",
    baseUrl: "https://api.siliconflow.cn/v1",
  },
  {
    id: "moonshot",
    label: "Moonshot 月之暗面",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  {
    id: "zhipu",
    label: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  },
  {
    id: "dashscope",
    label: "阿里百炼 DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
];

/** Which preset a stored base URL corresponds to, or custom when none. */
export function presetIdForBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) {
    return CUSTOM_PROVIDER_ID;
  }
  const match = LLM_PROVIDER_PRESETS.find(
    (preset) => preset.baseUrl === normalized
  );
  return match ? match.id : CUSTOM_PROVIDER_ID;
}
