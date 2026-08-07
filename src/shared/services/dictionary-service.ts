import { invoke } from "@tauri-apps/api/core";
import type {
  DictionaryEntry,
  DictionaryLookupResult,
  DictionaryMetadata,
} from "@/shared/types/dictionary";

export type DictionaryErrorCode =
  | "NOT_FOUND"
  | "MISSING_CACHE_PATH"
  | "INVALID_WORD"
  | "UNKNOWN";

export class DictionaryQueryError extends Error {
  constructor(
    message: string,
    public readonly code: DictionaryErrorCode,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "DictionaryQueryError";
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

function parseErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function determineErrorCode(message: string): DictionaryErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("not found")) {
    return "NOT_FOUND";
  }
  if (normalized.includes("cache path") && normalized.includes("not configured")) {
    return "MISSING_CACHE_PATH";
  }
  if (normalized.includes("word is required")) {
    return "INVALID_WORD";
  }
  return "UNKNOWN";
}

export async function queryDictionary(
  word: string,
  cachePath: string
): Promise<DictionaryLookupResult> {
  const trimmedWord = word.trim();
  if (!trimmedWord) {
    throw new DictionaryQueryError("Word is required", "INVALID_WORD");
  }

  const trimmedCachePath = cachePath.trim();
  if (!trimmedCachePath) {
    throw new DictionaryQueryError("Dictionary cache path is missing", "MISSING_CACHE_PATH");
  }

  try {
    return await invoke<DictionaryLookupResult>("dictionary_query", {
      word: trimmedWord,
      cache_path: trimmedCachePath,
      cachePath: trimmedCachePath,
    });
  } catch (error) {
    const message = parseErrorMessage(error);
    throw new DictionaryQueryError(message, determineErrorCode(message), { cause: error });
  }
}

/** Persist a user-generated entry into the local user dictionary. */
export async function writeDictionaryEntry(
  entry: DictionaryEntry,
  cachePath: string
) {
  const trimmedCachePath = cachePath.trim();
  if (!trimmedCachePath) {
    throw new DictionaryQueryError("Dictionary cache path is missing", "MISSING_CACHE_PATH");
  }

  await invoke("upsert_dictionary_entry", {
    args: {
      cachePath: trimmedCachePath,
      entry,
    },
  });
}

/** Read the metadata embedded in the installed dictionary artifact. */
export async function getDictionaryMetadata(
  cachePath: string
): Promise<DictionaryMetadata> {
  const trimmedCachePath = cachePath.trim();
  if (!trimmedCachePath) {
    throw new DictionaryQueryError("Dictionary cache path is missing", "MISSING_CACHE_PATH");
  }

  return invoke<DictionaryMetadata>("dictionary_metadata", {
    cachePath: trimmedCachePath,
  });
}
