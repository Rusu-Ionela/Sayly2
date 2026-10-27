/**
 * @jest-environment node
 */

type Handler = (...args: unknown[]) => void;

function jwt(expSeconds: number) {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode({ sub: "u1", exp: expSeconds })}.signature`;
}

const NOW = 1_800_000_000_000;

function fakeSocket() {
  const handlers = new Map<string, Handler>();
  const emits: { event: string; payload: unknown; ack: Handler }[] = [];
  const instance = {
    connected: false,
    on: jest.fn((event: string, handler: Handler) => handlers.set(event, handler)),
    timeout: jest.fn(() => ({
      emit: (event: string, payload: unknown, ack: Handler) => emits.push({ event, payload, ack }),
    })),
    disconnect: jest.fn(),
    connect: jest.fn(),
  };
  return { instance, handlers, emits };
}

describe("socket reauth before the access token expires", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function load(tokens: string[]) {
    const fake = fakeSocket();
    let authOption: ((cb: (data: object) => void) => void) | undefined;
    jest.doMock("socket.io-client", () => ({
      io: (_url: string, options: { auth: typeof authOption }) => {
        authOption = options.auth;
        return fake.instance;
      },
    }));
    jest.doMock("@/features/auth/authStorage", () => ({
      authStorage: { getTokens: jest.fn(async () => null) },
    }));
    const getFreshAccessToken = jest.fn(async () => tokens.shift() ?? null);
    jest.doMock("@/lib/apiClient", () => ({
      API_BASE_URL: "http://api.test",
      getFreshAccessToken,
      jwtExpiresAtMs: jest.requireActual("./apiClient").jwtExpiresAtMs,
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./socket") as typeof import("./socket");
    return { mod, fake, getFreshAccessToken, handshake: () => authOption };
  }

  async function connect(ctx: ReturnType<typeof load>) {
    ctx.mod.getSocket();
    await new Promise<void>((resolve) => ctx.handshake()?.(() => resolve()));
    ctx.fake.instance.connected = true;
    ctx.fake.handlers.get("connect")?.();
  }

  it("waits until 45 s before expiry, but never less than 5 s", () => {
    const { mod } = load([]);
    expect(mod.reauthDelayMs(NOW + 15 * 60_000, NOW)).toBe(15 * 60_000 - 45_000);
    expect(mod.reauthDelayMs(NOW + 10_000, NOW)).toBe(5_000);
    expect(mod.reauthDelayMs(null, NOW)).toBeNull();
  });

  it("sends a fresh token on the live socket and schedules the next one", async () => {
    const first = jwt(NOW / 1000 + 15 * 60);
    const second = jwt(NOW / 1000 + 30 * 60);
    const ctx = load([first, second]);
    await connect(ctx);

    await jest.advanceTimersByTimeAsync(15 * 60_000 - 45_000);
    expect(ctx.fake.emits).toHaveLength(1);
    expect(ctx.fake.emits[0]).toMatchObject({ event: "reauth", payload: { token: second } });

    ctx.fake.emits[0]!.ack(null, { ok: true });
    expect(jest.getTimerCount()).toBe(1);
  });

  it("stops when the socket disconnects", async () => {
    const ctx = load([jwt(NOW / 1000 + 15 * 60)]);
    await connect(ctx);
    ctx.fake.instance.connected = false;
    ctx.fake.handlers.get("disconnect")?.();

    await jest.advanceTimersByTimeAsync(20 * 60_000);
    expect(ctx.fake.emits).toHaveLength(0);
  });
});
