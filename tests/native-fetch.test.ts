import { afterEach, describe, expect, mock, test } from "bun:test";

let onStart: (args: any) => Promise<unknown> = async () => {};
const cancelled: string[] = [];
mock.module("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  Channel: class { onmessage?: (event: unknown) => void; },
  invoke: (command: string, args: any) => {
    if (command === "cancel_http_request") { cancelled.push(args.id); return Promise.resolve(); }
    return onStart(args);
  },
}));
mock.module("../src/shared/state/network-runtime", () => ({
  getRuntimeNetworkSettings: () => ({ proxyMode: "direct", proxyUrl: "", customCaPem: "test-ca" }),
}));
const { nativeFetch } = await import("../src/shared/services/native-fetch");
afterEach(() => { cancelled.length = 0; });

describe("native fetch bridge", () => {
  test("resolves on headers and exposes incremental UTF-8 chunks before completion", async () => {
    let events: any;
    onStart = async ({ args, onEvent }) => {
      expect(args.network.customCaPem).toBe("test-ca");
      expect(args.body).toBe('{"word":"apple"}');
      events = onEvent;
      queueMicrotask(() => onEvent.onmessage({ type: "headers", status: 200, headers: [["content-type", "text/event-stream"]] }));
    };
    const response = await nativeFetch("https://example.test/stream", { method: "POST", body: '{"word":"apple"}' });
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    events.onmessage({ type: "chunk", data: btoa("data: first\n\n") });
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: first\n\n");
    events.onmessage({ type: "chunk", data: Buffer.from("data: 苹果\n\n").toString("base64") });
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("data: 苹果\n\n");
    events.onmessage({ type: "end" });
    expect((await reader.read()).done).toBe(true);
  });

  test("reports network errors before headers", async () => {
    onStart = async ({ onEvent }) => { queueMicrotask(() => onEvent.onmessage({ type: "error", message: "untrusted certificate" })); };
    await expect(nativeFetch("https://example.test")).rejects.toThrow("untrusted certificate");
  });

  test("propagates a stream error after headers", async () => {
    let events: any;
    onStart = async ({ onEvent }) => {
      events = onEvent;
      queueMicrotask(() => onEvent.onmessage({ type: "headers", status: 200, headers: [] }));
    };
    const response = await nativeFetch("https://example.test");
    events.onmessage({ type: "error", message: "connection reset" });
    await expect(response.text()).rejects.toThrow("connection reset");
  });

  test("aborting during startup cancels once the native request is registered", async () => {
    let finishStart: () => void;
    let registered: () => void;
    const registration = new Promise<void>((resolve) => { registered = resolve; });
    onStart = () => { registered(); return new Promise<void>((resolve) => { finishStart = resolve; }); };
    const controller = new AbortController();
    const request = nativeFetch("https://example.test", { signal: controller.signal });
    await registration;
    controller.abort();
    await expect(request).rejects.toThrow();
    expect(cancelled).toHaveLength(0);
    finishStart!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled).toHaveLength(1);
  });

  test("body cancellation aborts the native request", async () => {
    onStart = async ({ onEvent }) => { queueMicrotask(() => onEvent.onmessage({ type: "headers", status: 200, headers: [] })); };
    const response = await nativeFetch("https://example.test");
    await response.body!.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelled).toHaveLength(1);
  });
});
