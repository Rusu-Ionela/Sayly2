import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMemoryRedis, setRedisCommandsForTests } from "../infra/redis/client";
import {
  publishRevocation,
  setFamilySocketRevoker,
  setUserSocketRevoker,
  subscribeToRevocation,
} from "./sessionRevocation";

describe("cross-process revocation bus", () => {
  beforeEach(async () => {
    getMemoryRedis().reset();
    setRedisCommandsForTests(getMemoryRedis());
    await subscribeToRevocation();
  });

  afterEach(() => {
    setUserSocketRevoker(() => undefined);
    setFamilySocketRevoker(() => undefined);
    setRedisCommandsForTests(null);
  });

  it("delivers user and family revocation events after publish", async () => {
    const users: string[] = [];
    const families: Array<{ userId: string; familyId: string }> = [];
    setUserSocketRevoker((userId) => {
      users.push(userId);
    });
    setFamilySocketRevoker((userId, familyId) => {
      families.push({ userId, familyId });
    });

    await publishRevocation({ type: "user", userId: "user-1" });
    await publishRevocation({ type: "family", userId: "user-1", familyId: "fam-9" });

    expect(users).toEqual(["user-1"]);
    expect(families).toEqual([{ userId: "user-1", familyId: "fam-9" }]);
  });
});
