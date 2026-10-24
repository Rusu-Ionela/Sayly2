import { MutationObserver, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/queryKeys";

import type { CurrentUserProfile } from "../types";

jest.mock("../api/profileApi", () => ({
  getMe: jest.fn(),
  getPublicProfile: jest.fn(),
  updateProfile: jest.fn(),
  updateSettings: jest.fn(),
}));

import { updateProfile, updateSettings } from "../api/profileApi";
import { updateProfileMutationOptions, updateSettingsMutationOptions } from "./useProfile";

const mockedUpdate = jest.mocked(updateProfile);
const mockedSettings = jest.mocked(updateSettings);

const cached: CurrentUserProfile = {
  id: "me",
  saylyId: "K7QF3MZA",
  mainTopic: null,
  email: "me@example.com",
  onboardingCompleted: true,
  displayName: "Ionela",
  bio: "",
  country: "RO",
  dateOfBirth: null,
  age: null,
  practiceGoals: [],
  spokenLanguages: [],
  learningLanguages: [],
  nativeLanguages: [],
  city: null,
  settings: {
    discoverable: true,
    showOnlineStatus: true,
    showSaylyId: true,
    showCertificates: true,
    translateTo: null,
    showLocation: true,
    notifyMessages: true,
    notifyConnectionRequests: true,
    notifyGroupActivity: true,
  },
  stats: { partners: 0, savedPhrases: 0, groups: 0, following: 0, newVisitors: 0 },
  isPro: false,
  topics: [],
  photos: [],
  certificates: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(onError?: (message: string) => void) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(queryKeys.profile.me, cached);
  const observer = new MutationObserver(client, updateProfileMutationOptions(client, { onError }));
  const current = () => client.getQueryData<CurrentUserProfile>(queryKeys.profile.me);
  return { observer, current };
}

describe("useUpdateProfile optimistic flow", () => {
  beforeEach(() => mockedUpdate.mockReset());

  it("shows the edit before the server answers, then stores the server version", async () => {
    const server = deferred<CurrentUserProfile>();
    mockedUpdate.mockReturnValue(server.promise);
    const { observer, current } = setup();

    const saving = observer.mutate({ displayName: "Ana" });
    // The request is sent only after onMutate has written the optimistic value.
    while (mockedUpdate.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(current()?.displayName).toBe("Ana");

    server.resolve({ ...cached, displayName: "Ana", profileCompleted: true });
    await saving;
    expect(current()).toEqual({ ...cached, displayName: "Ana", profileCompleted: true });
  });

  it("rolls back and reports a friendly message when the server rejects the edit", async () => {
    mockedUpdate.mockRejectedValue(
      new ApiError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Profile image must be 2 MB or smaller",
      }),
    );
    const onError = jest.fn();
    const { observer, current } = setup(onError);

    await expect(observer.mutate({ bio: "Hi", displayName: "Ana" })).rejects.toBeInstanceOf(
      ApiError,
    );

    expect(current()).toEqual(cached);
    expect(onError).toHaveBeenCalledWith("Profile image must be 2 MB or smaller");
  });
});

describe("useUpdateSettings optimistic flow", () => {
  beforeEach(() => mockedSettings.mockReset());

  it("flips the toggle immediately and rolls back on failure", async () => {
    const server = deferred<CurrentUserProfile>();
    mockedSettings.mockReturnValue(server.promise);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(queryKeys.profile.me, cached);
    const onError = jest.fn();
    const observer = new MutationObserver(
      client,
      updateSettingsMutationOptions(client, { onError }),
    );
    const current = () => client.getQueryData<CurrentUserProfile>(queryKeys.profile.me);

    const saving = observer.mutate({ discoverable: false });
    while (mockedSettings.mock.calls.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(current()?.settings.discoverable).toBe(false);

    server.reject(new ApiError({ status: 0, code: "NETWORK_ERROR", message: "offline" }));
    await expect(saving).rejects.toBeInstanceOf(ApiError);
    expect(current()?.settings.discoverable).toBe(true);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/offline/));
  });
});
