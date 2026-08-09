import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getRuntimeAudioSettings } from "@/shared/state/audio-runtime";
import { getRuntimeNetworkSettings } from "@/shared/state/network-runtime";
import { readAudioCacheFile } from "@/shared/services/audio-cache";

type TtsChunkEvent = {
  requestId: string;
  chunk: string;
  sequence: number;
  totalBytes: number;
};

export type TtsCompleteEvent = {
  requestId: string;
  totalBytes: number;
  cacheFilePath: string;
  format: string;
};

type TtsErrorEvent = {
  requestId: string;
  message: string;
};

export type StartTtsOptions = {
  text: string;
  format?: "mp3" | "wav" | "opus";
  cacheFilePath?: string;
  latency?: "normal" | "balanced";
  normalize?: boolean;
};

export type TtsStreamHandle = {
  requestId: string;
  stream: ReadableStream<Uint8Array>;
  completion: Promise<TtsCompleteEvent>;
  stop: () => Promise<void>;
};

const MIME_BY_FORMAT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: 'audio/wav; codecs="1"',
  opus: 'audio/ogg; codecs="opus"',
};

type ResolvedAudioConfig = {
  provider: "edge" | "fish" | "openai" | "elevenlabs";
  apiKey: string;
  model: string;
  /** Fish reference id, ElevenLabs voice id, or voice name elsewhere. */
  voice?: string;
  baseUrl?: string;
};

export async function startTtsStream(
  options: StartTtsOptions
): Promise<TtsStreamHandle> {
  if (!options.text?.trim()) {
    throw new Error("Text is required to start the TTS stream.");
  }

  const requestId = createRequestId();
  let unlistenChunk: UnlistenFn | null = null;
  let unlistenComplete: UnlistenFn | null = null;
  let unlistenError: UnlistenFn | null = null;
  let cleanedUp = false;
  let stopRequested = false;
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  let completionResolve!: (value: TtsCompleteEvent) => void;
  let completionReject!: (reason?: unknown) => void;
  let completionSettled = false;

  const completion = new Promise<TtsCompleteEvent>((resolve, reject) => {
    completionResolve = resolve;
    completionReject = reject;
  });

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    unlistenChunk?.();
    unlistenComplete?.();
    unlistenError?.();
    controllerRef = null;
  };

  const settleSuccess = (payload: TtsCompleteEvent) => {
    if (completionSettled) {
      return;
    }
    completionSettled = true;
    completionResolve(payload);
  };

  const settleError = (error: Error) => {
    if (completionSettled) {
      return;
    }
    completionSettled = true;
    completionReject(error);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      void (async () => {
        try {
          unlistenChunk = await listen<TtsChunkEvent>("tts-chunk", (event) => {
            if (event.payload.requestId !== requestId) {
              return;
            }

            controller.enqueue(decodeChunk(event.payload.chunk));
          });

          unlistenComplete = await listen<TtsCompleteEvent>(
            "tts-complete",
            (event) => {
              if (event.payload.requestId !== requestId) {
                return;
              }
              cleanup();
              controller.close();
              settleSuccess(event.payload);
            }
          );

          unlistenError = await listen<TtsErrorEvent>("tts-error", (event) => {
            if (event.payload.requestId !== requestId) {
              return;
            }

            cleanup();
            const error = new Error(event.payload.message);
            controller.error(error);
            settleError(error);
          });

          const audioConfig = resolveAudioConfig();
          const network = getRuntimeNetworkSettings();

          const command = invoke("start_tts_stream", {
            args: {
              text: options.text,
              proxyMode: network.proxyMode,
              proxyUrl: network.proxyUrl,
              requestId,
              format: options.format,
              cacheFilePath: options.cacheFilePath,
              provider: audioConfig.provider,
              baseUrl: audioConfig.baseUrl,
              referenceId:
                audioConfig.provider === "fish" ? audioConfig.voice : undefined,
              voice:
                audioConfig.provider === "fish" ? undefined : audioConfig.voice,
              model: audioConfig.model,
              apiKey: audioConfig.apiKey,
              latency: options.latency,
              normalize: options.normalize,
            },
          });

          command.catch((reason) => {
            const error = toError(reason);
            cleanup();
            controller.error(error);
            settleError(error);
          });
        } catch (reason) {
          const error = toError(reason);
          cleanup();
          controller.error(error);
          settleError(error);
        }
      })();
    },
    cancel() {
      cleanup();
      if (!completionSettled) {
        settleError(new DOMException("Stream cancelled.", "AbortError"));
      }
    },
  });

  return {
    requestId,
    stream,
    completion,
    stop: async () => {
      if (stopRequested) {
        return;
      }
      stopRequested = true;

      const error = new DOMException("Stream manually stopped", "AbortError");

      if (controllerRef) {
        try {
          controllerRef.error(error);
        } catch {
          // Stream might already be closed.
        }
      }

      cleanup();
      if (!completionSettled) {
        settleError(error);
      }
    },
  };
}

export type PlayTtsOptions = StartTtsOptions & {
  autoplay?: boolean;
  mimeTypeOverride?: string;
};

export type PlayTtsResult = {
  audio: HTMLAudioElement;
  completion: Promise<TtsCompleteEvent>;
  stop: () => Promise<void>;
};

export async function playTts(
  options: PlayTtsOptions
): Promise<PlayTtsResult> {
  const handle = await startTtsStream(options);
  const mimeType =
    options.mimeTypeOverride ??
    MIME_BY_FORMAT[options.format ?? "mp3"] ??
    "audio/mpeg";

  const player = new MediaSourceStreamPlayer(mimeType);
  const consumption = player.consume(handle.stream);

  // The stream finishing only means the download is done; completion should
  // report when sound actually stops. "ended" covers natural playback end,
  // "pause" covers stop()/dispose(), and a rejected play() covers platforms
  // that block autoplay - so this promise can never be left hanging.
  let resolvePlaybackSettled!: () => void;
  const playbackSettled = new Promise<void>((resolve) => {
    resolvePlaybackSettled = resolve;
  });
  player.element.addEventListener("ended", resolvePlaybackSettled);
  player.element.addEventListener("pause", resolvePlaybackSettled);

  if (options.autoplay ?? true) {
    void player.play().catch(() => {
      // Playback might be blocked by the platform. Consumers can call play() manually.
      resolvePlaybackSettled();
    });
  } else {
    resolvePlaybackSettled();
  }

  const onEnded = () => {
    player.element.removeEventListener("ended", onEnded);
    player.dispose();
  };
  player.element.addEventListener("ended", onEnded);

  const playbackCompletion = Promise.all([handle.completion, consumption]).then(
    async ([event]) => {
      await playbackSettled;
      return event;
    }
  );

  return {
    audio: player.element,
    completion: playbackCompletion,
    stop: async () => {
      player.element.removeEventListener("ended", onEnded);
      player.dispose();
      await handle.stop();
    },
  };
}

export async function playCachedAudio(
  filePath: string
): Promise<PlayTtsResult> {
  const bytes = await readAudioCacheFile(filePath);
  const blob = new Blob([bytes], {
    type: `audio/${inferFormatFromPath(filePath)}`,
  });
  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  audio.preload = "auto";

  let settled = false;
  let resolveCompletion!: (value: TtsCompleteEvent) => void;
  let rejectCompletion!: (reason?: unknown) => void;

  const completion = new Promise<TtsCompleteEvent>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  const cleanup = () => {
    audio.removeEventListener("ended", handleEnded);
    audio.removeEventListener("error", handleError);
    URL.revokeObjectURL(objectUrl);
  };

  const handleEnded = () => {
    if (settled) return;
    settled = true;
    cleanup();
    resolveCompletion({
      requestId: `cache:${filePath}`,
      totalBytes: 0,
      cacheFilePath: filePath,
      format: inferFormatFromPath(filePath),
    });
  };

  const handleError = () => {
    if (settled) return;
    settled = true;
    cleanup();
    rejectCompletion(new Error("Failed to play cached audio."));
  };

  audio.addEventListener("ended", handleEnded);
  audio.addEventListener("error", handleError);

  try {
    await audio.play();
  } catch (error) {
    cleanup();
    settled = true;
    rejectCompletion(
      error instanceof Error ? error : new Error("Failed to play cached audio.")
    );
    throw error;
  }

  return {
    audio,
    completion,
    stop: async () => {
      if (settled) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }

      settled = true;
      cleanup();
      audio.pause();
      audio.currentTime = 0;
      rejectCompletion(
        new DOMException("Stream manually stopped", "AbortError")
      );
    },
  };
}

class MediaSourceStreamPlayer {
  private mediaSource: MediaSource;
  private sourceBuffer: SourceBuffer | null = null;
  private audioElement: HTMLAudioElement;
  private objectUrl: string;
  private queue: Uint8Array[] = [];
  private disposed = false;
  private pendingClose = false;

  constructor(private readonly mimeType: string) {
    if (typeof window === "undefined" || typeof window.MediaSource === "undefined") {
      throw new Error("MediaSource API is not available in this environment.");
    }

    if (!MediaSource.isTypeSupported(this.mimeType)) {
      throw new Error(`MediaSource does not support MIME type: ${this.mimeType}`);
    }

    this.mediaSource = new MediaSource();
    this.audioElement = new Audio();
    this.objectUrl = URL.createObjectURL(this.mediaSource);
    this.audioElement.src = this.objectUrl;

    this.mediaSource.addEventListener("sourceopen", () => {
      if (this.sourceBuffer || this.disposed) {
        return;
      }
      this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
      this.sourceBuffer.addEventListener("updateend", () => {
        this.processQueue();
        if (this.pendingClose) {
          this.closeStream();
        }
      });

      this.processQueue();
      if (this.pendingClose && this.queue.length === 0) {
        this.closeStream();
      }
    });
  }

  get element(): HTMLAudioElement {
    return this.audioElement;
  }

  append(chunk: Uint8Array) {
    if (this.disposed) {
      return;
    }
    this.queue.push(chunk);
    this.processQueue();
  }

  async consume(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || this.disposed) {
          break;
        }
        if (value) {
          this.append(value);
        }
      }
    } finally {
      reader.releaseLock();
      this.finish();
    }
  }

  async play() {
    await this.audioElement.play();
  }

  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.pendingClose = false;
    this.stop();
    this.queue = [];
    try {
      URL.revokeObjectURL(this.objectUrl);
    } catch {
      // ignore
    }
    this.audioElement.src = "";
    if (this.mediaSource.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // ignore
      }
    }
  }

  private processQueue() {
    if (
      !this.sourceBuffer ||
      this.sourceBuffer.updating ||
      this.queue.length === 0 ||
      this.disposed
    ) {
      return;
    }

    const chunk = this.queue.shift();
    if (!chunk) {
      return;
    }

    try {
      this.sourceBuffer.appendBuffer(chunk);
    } catch {
      this.queue.unshift(chunk);
    }
  }

  private finish() {
    if (!this.sourceBuffer || this.sourceBuffer.updating) {
      this.pendingClose = true;
      return;
    }
    this.closeStream();
  }

  private closeStream() {
    if (this.mediaSource.readyState === "open") {
      try {
        this.mediaSource.endOfStream();
      } catch {
        // ignore
      }
    }
    this.pendingClose = false;
  }
}

function resolveAudioConfig(): ResolvedAudioConfig {
  const runtime = getRuntimeAudioSettings();

  if (runtime.provider === "edge") {
    return {
      provider: "edge",
      apiKey: "",
      model: "",
      voice: runtime.edge.voice.trim() || undefined,
    };
  }

  if (runtime.provider === "elevenlabs") {
    const apiKey = runtime.elevenlabs.apiKey.trim();
    const voiceId = runtime.elevenlabs.voiceId.trim();
    if (!apiKey || !voiceId) {
      throw new Error(
        "ElevenLabs API key and voice id are required. Configure them in Settings > Audio."
      );
    }

    return {
      provider: "elevenlabs",
      apiKey,
      voice: voiceId,
      model: runtime.elevenlabs.model.trim() || "eleven_multilingual_v2",
    };
  }

  if (runtime.provider === "openai") {
    const baseUrl = runtime.openai.baseUrl.trim();
    if (!baseUrl) {
      throw new Error(
        "TTS endpoint URL is missing. Configure it in Settings > Audio."
      );
    }

    return {
      provider: "openai",
      baseUrl,
      apiKey: runtime.openai.apiKey.trim(),
      model: runtime.openai.model.trim() || "tts-1",
      voice: runtime.openai.voice.trim() || "alloy",
    };
  }

  const apiKey = runtime.fish.apiKey.trim();
  if (!apiKey) {
    throw new Error("Audio API key is missing. Configure it in Settings > Audio.");
  }

  const voiceId = runtime.fish.voiceId.trim();
  return {
    provider: "fish",
    apiKey,
    model: runtime.fish.model.trim() || "s1",
    voice: voiceId.length > 0 ? voiceId : undefined,
  };
}

function decodeChunk(base64Value: string): Uint8Array {
  const binary = atob(base64Value);
  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  return new Error(typeof reason === "string" ? reason : "Unknown error");
}

function inferFormatFromPath(path: string): string {
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === path.length - 1) {
    return "file";
  }
  return path.substring(dotIndex + 1);
}
