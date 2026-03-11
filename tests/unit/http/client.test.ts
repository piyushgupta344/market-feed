import { describe, expect, it, vi } from "vitest";
import { ProviderError } from "../../../src/errors.js";
import { HttpClient } from "../../../src/http/client.js";

describe("HttpClient", () => {
  it("returns parsed JSON on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ data: 42 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient("test", { baseUrl: "https://example.com", retries: 0 });
    const result = await client.get<{ data: number }>("/endpoint");
    expect(result).toEqual({ data: 42 });

    vi.unstubAllGlobals();
  });

  it("throws ProviderError on non-ok status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: { get: () => "application/json" },
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient("test", { baseUrl: "https://example.com", retries: 0 });
    await expect(client.get("/endpoint")).rejects.toThrow(ProviderError);

    vi.unstubAllGlobals();
  });

  it("retries on 503 then succeeds", async () => {
    let calls = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 2) {
        return {
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          headers: { get: () => "application/json" },
        };
      }
      return {
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient("test", {
      baseUrl: "https://example.com",
      retries: 2,
      retryDelayMs: 0,
    });
    const result = await client.get("/endpoint");
    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2);

    vi.unstubAllGlobals();
  });

  it("appends query params to URL", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, headers: { get: () => "application/json" }, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new HttpClient("test", { baseUrl: "https://example.com", retries: 0 });
    await client.get("/search", { params: { q: "AAPL", limit: 10 } });
    expect(capturedUrl).toContain("q=AAPL");
    expect(capturedUrl).toContain("limit=10");

    vi.unstubAllGlobals();
  });
});
