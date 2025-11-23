export type FishAudioVoiceSummary = {
  id: string;
  title: string;
  description: string;
  languages: string[];
  tags: string[];
};

export class FishAudioServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "FishAudioServiceError";
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

type FishAudioModelItem = {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  languages?: string[];
  tags?: string[];
};

type ListModelsResponse = {
  items?: FishAudioModelItem[];
};

const API_BASE_URL = "https://api.fish.audio";
const LIST_MODELS_PATH = "/model/list-models";

function sanitizeVoice(item?: FishAudioModelItem): FishAudioVoiceSummary | null {
  if (!item) {
    return null;
  }

  const id = item._id || item.id;
  if (!id) {
    return null;
  }

  return {
    id,
    title: item.title || id,
    description: item.description ?? "",
    languages: item.languages ?? [],
    tags: item.tags ?? [],
  };
}

export async function fetchFishAudioVoices(
  apiKey: string
): Promise<FishAudioVoiceSummary[]> {
  const token = apiKey.trim();
  if (!token) {
    throw new FishAudioServiceError("Audio API key is missing.");
  }

  const params = new URLSearchParams({
    page: "1",
    limit: "200",
    size: "200",
    type: "svc",
    visibility: "public",
  });

  const response = await fetch(`${API_BASE_URL}${LIST_MODELS_PATH}?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    throw new FishAudioServiceError(
      `Failed to load voices (${response.status}).`,
      { cause: details }
    );
  }

  const payload = (await response.json()) as ListModelsResponse;
  if (!payload.items || !Array.isArray(payload.items)) {
    return [];
  }

  const voices = payload.items
    .map(sanitizeVoice)
    .filter((voice): voice is FishAudioVoiceSummary => Boolean(voice));

  return voices;
}
