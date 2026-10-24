/**
 * @jest-environment node
 */

describe("apiClient auth behavior", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = "http://api.test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  function loadClient() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./apiClient") as typeof import("./apiClient");
  }

  it("attaches Authorization for protected routes", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiClient, configureApiAuth } = loadClient();
    configureApiAuth({
      getAccessToken: () => "access-1",
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: () => undefined,
      onAuthFailure: () => undefined,
    });

    await apiClient.get("/users/me");
    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("skips Authorization on auth endpoints", async () => {
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiClient, configureApiAuth } = loadClient();
    configureApiAuth({
      getAccessToken: () => "access-1",
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: () => undefined,
      onAuthFailure: () => undefined,
    });

    await apiClient.post("/auth/login", { email: "a@b.c", password: "x" });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("shares one refresh across concurrent 401s", async () => {
    let refreshCalls = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return new Response(
          JSON.stringify({ accessToken: "access-2", refreshToken: "refresh-2" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const auth = new Headers(init?.headers).get("Authorization");
      if (auth === "Bearer access-1") {
        return new Response(JSON.stringify({ error: { message: "expired" } }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiClient, configureApiAuth } = loadClient();
    configureApiAuth({
      getAccessToken: () => (refreshCalls > 0 ? "access-2" : "access-1"),
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: () => undefined,
      onAuthFailure: () => undefined,
    });

    await Promise.all([apiClient.get("/users/me"), apiClient.get("/discover/users")]);
    expect(refreshCalls).toBe(1);
  });

  it("replays a POST once after an expired token is refreshed", async () => {
    let token = "access-1";
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/auth/refresh")) {
        token = "access-2";
        return new Response(
          JSON.stringify({ accessToken: "access-2", refreshToken: "refresh-2" }),
          {
            status: 200,
          },
        );
      }
      const auth = new Headers(init?.headers).get("Authorization");
      return auth === "Bearer access-1"
        ? new Response(JSON.stringify({ error: { message: "expired" } }), { status: 401 })
        : new Response(JSON.stringify({ sent: true }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { apiClient, configureApiAuth } = loadClient();
    configureApiAuth({
      getAccessToken: () => token,
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: () => undefined,
      onAuthFailure: () => undefined,
    });

    await expect(apiClient.post("/follows/u1", {})).resolves.toEqual({ sent: true });
  });
});
