import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));

vi.mock("./repository", () => ({
  findOwnAnswer: vi.fn(),
  countVisibleAnswers: vi.fn(),
  listVisibleAnswers: vi.fn(),
  saveAnswer: vi.fn(),
  deleteAnswer: vi.fn(),
}));

vi.mock("../streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../streaks")>()),
  recordActivityInBackground: vi.fn(),
}));

vi.mock("../users/memberSummary", () => ({
  loadMemberSummaries: vi.fn(),
}));

import { createApp } from "../../lib/app";
import { recordActivityInBackground } from "../streaks";
import { loadMemberSummaries } from "../users/memberSummary";
import { ICEBREAKER_PROMPTS } from "./catalog";
import { pickPrompt, promptDay, toPromptDto } from "./prompt";
import * as repository from "./repository";

const repo = vi.mocked(repository);
const app = createApp();
const auth = { Authorization: "Bearer t" };

describe("prompt of the day", () => {
  it("is the same for everyone on a day and changes the next day", () => {
    expect(pickPrompt("es", "2026-10-24").id).toBe(pickPrompt("es", "2026-10-24").id);
    expect(pickPrompt("es", "2026-10-25").id).not.toBe(pickPrompt("es", "2026-10-24").id);
  });

  it("walks through the whole catalog before repeating", () => {
    const ids = new Set<string>();
    for (let day = 0; day < ICEBREAKER_PROMPTS.length; day += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
      ids.add(pickPrompt("fr", date).id);
    }
    expect(ids.size).toBe(ICEBREAKER_PROMPTS.length);
  });

  it("uses the translation, its regional variant, or English", () => {
    const prompt = pickPrompt("es", "2026-10-24");
    expect(toPromptDto(prompt, "es", "2026-10-24")).toMatchObject({
      text: prompt.translations.es,
      english: prompt.en,
      translated: true,
    });
    expect(toPromptDto(prompt, "pt-br", "2026-10-24").text).toBe(prompt.translations.pt);
    expect(toPromptDto(prompt, "ja", "2026-10-24")).toMatchObject({ text: prompt.en, translated: false });
  });

  it("comes in the language being learned for every translated language", () => {
    const day = "2026-10-24";
    for (const code of ["es", "fr", "de", "it", "pt", "ro"] as const) {
      const prompt = pickPrompt(code, day);
      expect(toPromptDto(prompt, code, day).text).toBe(prompt.translations[code]);
    }
    expect(toPromptDto(pickPrompt("en", day), "en", day)).toMatchObject({ translated: true });
  });

  it("has unique ids and every translation filled in", () => {
    expect(new Set(ICEBREAKER_PROMPTS.map((prompt) => prompt.id)).size).toBe(ICEBREAKER_PROMPTS.length);
    for (const prompt of ICEBREAKER_PROMPTS) {
      for (const text of Object.values(prompt.translations)) {
        expect(text.trim().length).toBeGreaterThan(5);
      }
    }
  });
});

describe("icebreaker routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns today's prompt with my answer and the answer count", async () => {
    repo.findOwnAnswer.mockResolvedValue({ body: "Hola", updatedAt: new Date("2026-10-24T08:00:00Z") });
    repo.countVisibleAnswers.mockResolvedValue(4);

    const res = await request(app).get("/icebreakers/today?languageId=ES").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.prompt).toMatchObject({ languageId: "es", date: promptDay() });
    expect(res.body).toMatchObject({ myAnswer: { body: "Hola" }, answerCount: 4 });
  });

  it("rejects a language Sayly does not offer", async () => {
    const res = await request(app).get("/icebreakers/today?languageId=xx").set(auth);
    expect(res.status).toBe(400);
  });

  it("saves a cleaned answer and counts the streak day", async () => {
    repo.saveAnswer.mockResolvedValue({ body: "Me gusta el café", updatedAt: new Date() });

    const res = await request(app)
      .put("/icebreakers/today/answer")
      .set(auth)
      .send({ languageId: "es", body: "  Me gusta   el café  " });

    expect(res.status).toBe(200);
    expect(repo.saveAnswer).toHaveBeenCalledWith(
      "viewer-1",
      expect.objectContaining({ languageId: "es", body: "Me gusta el café", promptDate: promptDay() }),
    );
    expect(recordActivityInBackground).toHaveBeenCalledWith("viewer-1");
  });

  it("rejects an empty or extra-field answer", async () => {
    const empty = await request(app).put("/icebreakers/today/answer").set(auth).send({ languageId: "es", body: "   " });
    const extra = await request(app)
      .put("/icebreakers/today/answer")
      .set(auth)
      .send({ languageId: "es", body: "Hi", userId: "someone-else" });
    expect(empty.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(repo.saveAnswer).not.toHaveBeenCalled();
  });

  it("lists answers with their authors and drops members who are gone", async () => {
    repo.listVisibleAnswers.mockResolvedValue({
      rows: [
        { id: "a1", userId: "u1", body: "Tostadas", createdAt: new Date("2026-10-24T09:00:00Z") },
        { id: "a2", userId: "gone", body: "x", createdAt: new Date("2026-10-24T08:00:00Z") },
      ],
      hasMore: true,
    });
    vi.mocked(loadMemberSummaries).mockResolvedValue(
      new Map([
        [
          "u1",
          {
            id: "u1",
            displayName: "Lucía",
            avatarUrl: null,
            country: "ES",
            city: null,
            isPro: false,
            nativeLanguage: null,
            learningLanguage: null,
            onlineStatus: "UNKNOWN",
            lastSeen: null,
          },
        ],
      ]),
    );

    const res = await request(app).get("/icebreakers/today/answers?languageId=es").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      {
        id: "a1",
        body: "Tostadas",
        createdAt: "2026-10-24T09:00:00.000Z",
        author: { id: "u1", displayName: "Lucía", avatarUrl: null, country: "ES" },
      },
    ]);
    expect(res.body.nextCursor).toBe("a2");
  });
});
