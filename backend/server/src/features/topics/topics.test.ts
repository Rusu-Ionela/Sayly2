import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTopicSchema, TOPIC_TITLE_MAX } from "@sayly/shared";

vi.mock("../../shared/middleware/authenticate", () => import("../../test/authMock"));
vi.mock("./service", () => {
  const list = async () => ({ items: [], max: 10 });
  return {
    listTopics: vi.fn(list),
    createTopic: vi.fn(list),
    setMainTopic: vi.fn(list),
    deleteTopic: vi.fn(list),
  };
});

import { createApp } from "../../lib/app";
import { TEST_VIEWER_ID } from "../../test/authMock";
import * as topicsService from "./service";

const service = vi.mocked(topicsService);
const app = createApp();
const auth = { Authorization: "Bearer test" };

describe("conversation topics", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("validation", () => {
    it("trims titles and enforces their length", () => {
      expect(createTopicSchema.parse({ title: "  Street   food  " }).title).toBe("Street food");
      expect(() => createTopicSchema.parse({ title: "ab" })).toThrow();
      expect(() => createTopicSchema.parse({ title: "x".repeat(TOPIC_TITLE_MAX + 1) })).toThrow();
    });

    it("rejects unknown fields (no writing other members' topics)", () => {
      expect(() => createTopicSchema.parse({ title: "Travel tips", userId: "u2" })).toThrow();
    });
  });

  describe("routes", () => {
    it("scopes every call to the authenticated member", async () => {
      await request(app).get("/topics").set(auth).expect(200);
      expect(service.listTopics).toHaveBeenCalledWith(TEST_VIEWER_ID);

      await request(app)
        .post("/topics")
        .set(auth)
        .send({ title: "Learning to surf", isMain: true })
        .expect(201);
      expect(service.createTopic).toHaveBeenCalledWith(TEST_VIEWER_ID, {
        title: "Learning to surf",
        isMain: true,
      });

      await request(app).delete("/topics/topic-1").set(auth).expect(200);
      expect(service.deleteTopic).toHaveBeenCalledWith(TEST_VIEWER_ID, "topic-1");
    });

    it("only allows promoting a topic to main", async () => {
      await request(app).patch("/topics/topic-1").set(auth).send({ isMain: false }).expect(400);
      expect(service.setMainTopic).not.toHaveBeenCalled();

      await request(app).patch("/topics/topic-1").set(auth).send({ isMain: true }).expect(200);
      expect(service.setMainTopic).toHaveBeenCalledWith(TEST_VIEWER_ID, "topic-1");
    });

    it("requires authentication", async () => {
      await request(app).post("/topics").send({ title: "Anything" }).expect(401);
      expect(service.createTopic).not.toHaveBeenCalled();
    });
  });
});
