import { invoke } from "@tauri-apps/api/core";

export type AudioCacheOptions = {
  provider?: string | null;
  model?: string | null;
  voiceId?: string | null;
  format?: string | null;
};

export type AudioCacheEntry = {
  path: string;
  exists: boolean;
};

export async function resolveAudioCache(
  word: string,
  options: AudioCacheOptions = {}
): Promise<AudioCacheEntry> {
  const result = await invoke<AudioCacheEntry>("resolve_audio_cache_entry", {
    args: {
      word,
      provider: options.provider ?? null,
      model: options.model ?? null,
      voiceId: options.voiceId ?? null,
      format: options.format ?? null,
    },
  });

  return result;
}

export async function readAudioCacheFile(path: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("read_audio_cache_file", {
    args: { path },
  });
  return new Uint8Array(bytes);
}
