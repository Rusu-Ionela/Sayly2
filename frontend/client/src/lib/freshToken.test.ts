/**
 * @jest-environment node
 */

function jwt(expSeconds: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ sub: "u1", exp: expSeconds })}.signature`;
}

describe("fresh access token for the socket handshake", () => {
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

  it("reads the expiry of a JWT", () => {
    const { jwtExpiresAtMs } = loadClient();
    expect(jwtExpiresAtMs(jwt(1_800_000_000))).toBe(1_800_000_000_000);
    expect(jwtExpiresAtMs("not-a-jwt")).toBeNull();
  });

  it("keeps a token that is valid for more than a minute", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const { configureApiAuth, getFreshAccessToken } = loadClient();
    const now = 1_800_000_000_000;
    const token = jwt(now / 1000 + 600);
    configureApiAuth({
      getAccessToken: () => token,
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: () => undefined,
      onAuthFailure: () => undefined,
    });

    await expect(getFreshAccessToken(now)).resolves.toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes a token about to expire before handing it out", async () => {
    const now = 1_800_000_000_000;
    let current = jwt(now / 1000 + 20);
    const renewed = jwt(now / 1000 + 900);
    const fetchMock = jest.fn(async (_url: string) => {
      return new Response(JSON.stringify({ accessToken: renewed, refreshToken: "refresh-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { configureApiAuth, getFreshAccessToken } = loadClient();
    configureApiAuth({
      getAccessToken: () => current,
      getRefreshToken: () => "refresh-1",
      onTokensRefreshed: (tokens: { accessToken: string }) => {
        current = tokens.accessToken;
      },
      onAuthFailure: () => undefined,
    });

    await expect(getFreshAccessToken(now)).resolves.toBe(renewed);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0]).endsWith("/auth/refresh")).toBe(true);
  });
});
