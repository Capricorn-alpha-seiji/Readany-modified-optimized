import { useSettingsStore } from "@/stores/settings-store";

const REMOTE_PROTOCOLS = new Set(["http:", "https:", "ws:", "wss:"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "ipc.localhost", "asset.localhost", "tauri.localhost"]);
const NETWORK_GUARD_FLAG = "__readanyNetworkGuardInstalled";
const XHR_URL_KEY = "__readanyNetworkGuardUrl";

export function isNetworkEnabled(): boolean {
  return useSettingsStore.getState().networkEnabled === true;
}

function getUrlString(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  const candidate = input as { url?: unknown };
  return typeof candidate.url === "string" ? candidate.url : null;
}

export function isRemoteNetworkUrl(input: RequestInfo | URL): boolean {
  const raw = getUrlString(input);
  if (!raw) return false;

  try {
    const base = typeof window !== "undefined" ? window.location.href : "http://localhost";
    const url = new URL(raw, base);
    if (!REMOTE_PROTOCOLS.has(url.protocol)) return false;

    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")) return false;

    return true;
  } catch {
    return false;
  }
}

export function assertNetworkAllowed(input: RequestInfo | URL): void {
  if (!isRemoteNetworkUrl(input)) return;
  if (isNetworkEnabled()) return;
  throw new Error(
    "Network access is disabled. Enable Settings > General > Allow network access to use online services.",
  );
}

export function guardFetch(fetchImpl: typeof fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    assertNetworkAllowed(input);
    return fetchImpl(input, init);
  }) as typeof fetch;
}

function installFetchGuard(): void {
  if (typeof window.fetch !== "function") return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = guardFetch(nativeFetch);
}

function installWebSocketGuard(): void {
  if (typeof window.WebSocket !== "function") return;
  const NativeWebSocket = window.WebSocket;

  const GuardedWebSocket = function (
    this: WebSocket,
    url: string | URL,
    protocols?: string | string[],
  ) {
    assertNetworkAllowed(url);
    return protocols === undefined
      ? new NativeWebSocket(url)
      : new NativeWebSocket(url, protocols);
  } as unknown as typeof WebSocket;

  GuardedWebSocket.prototype = NativeWebSocket.prototype;
  Object.defineProperties(GuardedWebSocket, {
    CONNECTING: { value: NativeWebSocket.CONNECTING },
    OPEN: { value: NativeWebSocket.OPEN },
    CLOSING: { value: NativeWebSocket.CLOSING },
    CLOSED: { value: NativeWebSocket.CLOSED },
  });

  window.WebSocket = GuardedWebSocket;
}

function installEventSourceGuard(): void {
  if (typeof window.EventSource !== "function") return;
  const NativeEventSource = window.EventSource;

  const GuardedEventSource = function (
    this: EventSource,
    url: string | URL,
    eventSourceInitDict?: EventSourceInit,
  ) {
    assertNetworkAllowed(url);
    return new NativeEventSource(url, eventSourceInitDict);
  } as unknown as typeof EventSource;

  GuardedEventSource.prototype = NativeEventSource.prototype;
  Object.defineProperties(GuardedEventSource, {
    CONNECTING: { value: NativeEventSource.CONNECTING },
    OPEN: { value: NativeEventSource.OPEN },
    CLOSED: { value: NativeEventSource.CLOSED },
  });

  window.EventSource = GuardedEventSource;
}

function installXmlHttpRequestGuard(): void {
  if (typeof window.XMLHttpRequest !== "function") return;
  const originalOpen = window.XMLHttpRequest.prototype.open;
  const originalSend = window.XMLHttpRequest.prototype.send;

  window.XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ) {
    (this as unknown as Record<string, string>)[XHR_URL_KEY] = String(url);
    return originalOpen.call(this, method, url, async ?? true, username, password);
  } as XMLHttpRequest["open"];

  window.XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const url = (this as unknown as Record<string, string>)[XHR_URL_KEY];
    if (url) assertNetworkAllowed(url);
    return originalSend.call(this, body);
  };
}

export function installNetworkGuard(): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as Record<string, boolean>;
  if (win[NETWORK_GUARD_FLAG]) return;
  win[NETWORK_GUARD_FLAG] = true;

  installFetchGuard();
  installWebSocketGuard();
  installEventSourceGuard();
  installXmlHttpRequestGuard();
}
