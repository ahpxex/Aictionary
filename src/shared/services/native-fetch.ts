import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { getRuntimeNetworkSettings } from "@/shared/state/network-runtime";

type HttpEvent =
  | { type: "headers"; status: number; headers: [string, string][] }
  | { type: "chunk"; data: string }
  | { type: "end" }
  | { type: "error"; message: string };

/** Preserve fetch's streaming body and abort behavior across the native bridge. */
export async function nativeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!isTauri()) return fetch(input, init);
  const request = new Request(input, init);
  request.signal.throwIfAborted();
  const body = request.body ? await request.text() : null;
  request.signal.throwIfAborted();
  // WKWebView's custom app origin may not expose secure-context randomUUID.
  // getRandomValues is available there and still gives each request a random ID.
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
  return new Promise<Response>((resolve, reject) => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let ended = false;
    let started: Promise<unknown>;
    const cancel = () => { void started.then(() => invoke("cancel_http_request", { id })).catch(() => {}); };
    const cleanup = () => { request.signal.removeEventListener("abort", abort); };
    const fail = (error: unknown) => {
      if (ended) return;
      ended = true;
      cleanup();
      const reason = error instanceof Error ? error : new Error(String(error));
      controller.error(reason);
      reject(reason);
    };
    const abort = () => { fail(request.signal.reason ?? new DOMException("Aborted", "AbortError")); cancel(); };
    const stream = new ReadableStream<Uint8Array>({
      start(value) { controller = value; },
      cancel() { ended = true; cleanup(); cancel(); },
    });
    const channel = new Channel<HttpEvent>();
    channel.onmessage = (event) => {
      if (ended) return;
      if (event.type === "headers") {
        const hasBody = request.method !== "HEAD" && ![204, 205, 304].includes(event.status);
        resolve(new Response(hasBody ? stream : null, { status: event.status, headers: event.headers }));
      } else if (event.type === "chunk") {
        controller.enqueue(Uint8Array.from(atob(event.data), (character) => character.charCodeAt(0)));
      } else if (event.type === "end") {
        ended = true;
        cleanup();
        controller.close();
      } else { fail(new Error(event.message)); }
    };
    started = invoke("start_http_request", {
      args: { id, url: request.url, method: request.method, headers: Array.from(request.headers.entries()), body, network: getRuntimeNetworkSettings() },
      onEvent: channel,
    }).catch((error: unknown) => { fail(error); throw error; });
    // Attach a rejection handler even when the request is never aborted.
    void started.catch(() => {});
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
  });
}
