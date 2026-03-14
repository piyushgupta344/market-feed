import { describe, expect, it, vi } from "vitest";
import { createFetchWithProxy, installCorsProxy } from "../../../src/browser/index.js";

// ---------------------------------------------------------------------------
// createFetchWithProxy
// ---------------------------------------------------------------------------

describe("createFetchWithProxy", () => {
  it("prepends proxy URL for string inputs", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://corsproxy.io/?");
    await proxied("https://api.example.com/data");

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe(
      `https://corsproxy.io/?${encodeURIComponent("https://api.example.com/data")}`,
    );
    vi.unstubAllGlobals();
  });

  it("prepends proxy URL for URL object inputs", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://corsproxy.io/?");
    await proxied(new URL("https://api.example.com/prices?symbol=AAPL"));

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("https://corsproxy.io/?");
    expect(calledUrl).toContain(encodeURIComponent("https://api.example.com"));
    vi.unstubAllGlobals();
  });

  it("prepends proxy URL for Request object inputs", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://corsproxy.io/?");
    const req = new Request("https://api.example.com/news");
    await proxied(req);

    const calledUrl = (mockFetch.mock.calls[0]?.[0] as Request).url;
    expect(calledUrl).toContain("https://corsproxy.io/?");
    expect(calledUrl).toContain(encodeURIComponent("https://api.example.com/news"));
    vi.unstubAllGlobals();
  });

  it("passes through init options unchanged", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://corsproxy.io/?");
    const init: RequestInit = { headers: { Authorization: "Bearer token" } };
    await proxied("https://api.example.com/data", init);

    expect(mockFetch.mock.calls[0]?.[1]).toBe(init);
    vi.unstubAllGlobals();
  });

  it("works with different proxy URL formats", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://api.allorigins.win/raw?url=");
    await proxied("https://api.example.com/quote");

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^https:\/\/api\.allorigins\.win\/raw\?url=/);
    vi.unstubAllGlobals();
  });

  it("encodes special characters in original URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const proxied = createFetchWithProxy("https://proxy.example.com/?url=");
    await proxied("https://api.example.com/data?foo=bar&baz=qux");

    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    // The & in the original URL should be encoded so it doesn't break proxy query params
    expect(calledUrl).not.toMatch(/https:\/\/proxy\.example\.com\/\?url=.*[^%]&/);
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// installCorsProxy
// ---------------------------------------------------------------------------

describe("installCorsProxy", () => {
  it("replaces globalThis.fetch with a proxied version", async () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response("proxied"));
    vi.stubGlobal("fetch", mockFetch);

    const uninstall = installCorsProxy("https://corsproxy.io/?");

    // fetch should now be the proxy wrapper, not the mock directly
    expect(globalThis.fetch).not.toBe(mockFetch);

    // Calling the proxied fetch routes through proxy
    await globalThis.fetch("https://api.example.com/data");
    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("https://corsproxy.io/?");

    uninstall();
    vi.unstubAllGlobals();
    // Restore original to avoid polluting other tests
    globalThis.fetch = original;
  });

  it("restores original fetch when uninstall is called", () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const saved = globalThis.fetch;
    const uninstall = installCorsProxy("https://corsproxy.io/?");

    expect(globalThis.fetch).not.toBe(saved);

    uninstall();

    expect(globalThis.fetch).toBe(saved);
    vi.unstubAllGlobals();
    globalThis.fetch = original;
  });

  it("returns a function that restores fetch", () => {
    const original = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const uninstall = installCorsProxy("https://corsproxy.io/?");
    expect(typeof uninstall).toBe("function");

    uninstall();
    vi.unstubAllGlobals();
    globalThis.fetch = original;
  });
});
