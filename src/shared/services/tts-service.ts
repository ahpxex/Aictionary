import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

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
  referenceId?: string;
  model?: string;
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

export async function startFishTtsStream(
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

          const command = invoke("start_tts_stream", {
            args: {
              text: options.text,
              requestId,
              format: options.format,
              cacheFilePath: options.cacheFilePath,
              referenceId: options.referenceId,
              model: options.model,
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
      settleError(new Error("Stream cancelled."));
    },
  });

  return {
    requestId,
    stream,
    completion,
    stop: async () => {
      await stream.cancel("manual-stop");
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

export async function playFishTts(
  options: PlayTtsOptions
): Promise<PlayTtsResult> {
  const handle = await startFishTtsStream(options);
  const mimeType =
    options.mimeTypeOverride ??
    MIME_BY_FORMAT[options.format ?? "mp3"] ??
    "audio/mpeg";

  const player = new MediaSourceStreamPlayer(mimeType);
  const consumption = player.consume(handle.stream);

  if (options.autoplay ?? true) {
    void player.play().catch(() => {
      // Playback might be blocked by the platform. Consumers can call play() manually.
    });
  }

  const playbackCompletion = Promise.all([handle.completion, consumption]).then(
    ([event]) => event
  );
  playbackCompletion.finally(() => {
    player.dispose();
  });

  return {
    audio: player.element,
    completion: playbackCompletion,
    stop: async () => {
      player.dispose();
      await handle.stop();
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
