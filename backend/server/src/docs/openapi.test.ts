import { expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../lib/app";

it("documents the profile dashboard endpoints", async () => {
  const res = await request(createApp()).get("/api-docs/openapi.json").expect(200);
  const paths = Object.keys(res.body.paths ?? {});
  expect(paths).toEqual(
    expect.arrayContaining([
      "/follows",
      "/follows/{userId}",
      "/users/{userId}/references",
      "/profile-views/visitors",
      "/profile-views/viewed",
      "/topics",
      "/topics/{topicId}",
      "/users/by-sayly-id/{saylyId}",
      "/users/me/export",
      "/certificates/offers",
      "/learning/expressions",
      "/support/tickets",
      "/support/bug-report",
      "/support/feature-request",
    ]),
  );
});
