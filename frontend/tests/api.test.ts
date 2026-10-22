import { afterEach, describe, expect, it, vi } from "vitest";
import { api, setUnauthorizedHandler } from "@/lib/api";

const unauthorized = () =>
  Promise.resolve(new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no" } }), { status: 401 }));

afterEach(() => {
  setUnauthorizedHandler(undefined);
  vi.unstubAllGlobals();
});

describe("401 handling", () => {
  it("does not treat the startup /auth/me check as an expired session", async () => {
    vi.stubGlobal("fetch", vi.fn(unauthorized));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("signs the user out when a data request returns 401", async () => {
    vi.stubGlobal("fetch", vi.fn(unauthorized));
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(api.listProjects()).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledOnce();
  });
});
