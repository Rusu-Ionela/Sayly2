import { ApiError } from "@/lib/api/errors";
import { testProfile } from "@/test/fixtures/profile";

import type { EditProfileFormValues } from "../schema";

import { base64ByteLength, profileAvatarUrl } from "./avatar";
import { profileErrorMessage } from "./profileErrors";
import { applyProfilePatch, applySettingsPatch } from "./profilePatch";
import { buildProfilePayload } from "./profilePayload";

const initialForm: EditProfileFormValues = {
  displayName: "Ionela",
  bio: "Learning daily",
  country: "RO",
  city: "",
  dateOfBirth: "1998-04-02",
  avatarUrl: "/media/files/old.jpg",
  practiceGoals: ["Speaking"],
  topics: ["Travel"],
  photos: ["/media/files/p1.jpg"],
  certificates: [],
  spokenLanguages: [{ languageId: "ro", proficiency: "NATIVE" }],
  learningLanguages: [{ languageId: "en", proficiency: "BEGINNER" }],
};

const profile = testProfile;

describe("buildProfilePayload", () => {
  it("sends nothing when nothing changed (whitespace-only edits included)", () => {
    expect(buildProfilePayload({ ...initialForm, displayName: " Ionela " }, initialForm)).toEqual(
      {},
    );
  });

  it("sends only changed fields and never re-sends an unchanged avatar", () => {
    const payload = buildProfilePayload({ ...initialForm, bio: "  New bio " }, initialForm);
    expect(payload).toEqual({ bio: "New bio" });
  });

  it("maps a removed photo to null and a new inline photo to its data URI", () => {
    expect(buildProfilePayload({ ...initialForm, avatarUrl: "" }, initialForm)).toEqual({
      avatarUrl: null,
    });
    const dataUri = "data:image/jpeg;base64,/9j/4AAQ";
    expect(buildProfilePayload({ ...initialForm, avatarUrl: dataUri }, initialForm)).toEqual({
      avatarUrl: dataUri,
    });
  });

  it("sends spoken and learning languages together when either changes", () => {
    const payload = buildProfilePayload(
      { ...initialForm, learningLanguages: [{ languageId: "es", proficiency: "BEGINNER" }] },
      initialForm,
    );
    expect(payload).toEqual({
      spokenLanguages: initialForm.spokenLanguages,
      learningLanguages: [{ languageId: "es", proficiency: "BEGINNER" }],
    });
  });

  it("does not try to clear the date of birth", () => {
    expect(buildProfilePayload({ ...initialForm, dateOfBirth: "" }, initialForm)).toEqual({});
  });
});

describe("applyProfilePatch (optimistic update)", () => {
  it("applies scalar fields and keeps the rest untouched", () => {
    const next = applyProfilePatch(profile, { displayName: "Ana", city: "Iasi" });
    expect(next.displayName).toBe("Ana");
    expect(next.city).toBe("Iasi");
    expect(next.bio).toBe(profile.bio);
    expect(next).not.toBe(profile);
    expect(profile.displayName).toBe("Ionela");
  });

  it("updates every avatar alias, including removal", () => {
    expect(
      profileAvatarUrl(applyProfilePatch(profile, { avatarUrl: "data:image/jpeg;base64,AA" })),
    ).toBe("data:image/jpeg;base64,AA");
    const cleared = applyProfilePatch(profile, { avatarUrl: null });
    expect(profileAvatarUrl(cleared)).toBeUndefined();
  });

  it("resolves new languages from the catalog and recomputes native languages", () => {
    const next = applyProfilePatch(
      profile,
      {
        spokenLanguages: [
          { languageId: "ro", proficiency: "FLUENT" },
          { languageId: "es", proficiency: "NATIVE" },
        ],
        learningLanguages: [{ languageId: "en", proficiency: "INTERMEDIATE" }],
      },
      [{ id: "es", code: "es", name: "Spanish", flagEmoji: "🇪🇸" }],
    );

    expect(next.spokenLanguages).toEqual([
      { languageId: "ro", code: "ro", name: "Romanian", flagEmoji: "🇷🇴", proficiency: "FLUENT" },
      { languageId: "es", code: "es", name: "Spanish", flagEmoji: "🇪🇸", proficiency: "NATIVE" },
    ]);
    expect(next.learningLanguages[0]?.proficiency).toBe("INTERMEDIATE");
    expect(next.nativeLanguages).toEqual(["Spanish"]);
  });
});

describe("avatar helpers", () => {
  it("computes decoded base64 size", () => {
    expect(base64ByteLength("")).toBe(0);
    expect(base64ByteLength("YQ==")).toBe(1);
    expect(base64ByteLength("YWI=")).toBe(2);
    expect(base64ByteLength("YWJj")).toBe(3);
  });
});

describe("profileErrorMessage", () => {
  it("surfaces server validation messages and maps transport failures", () => {
    expect(
      profileErrorMessage(
        new ApiError({
          status: 400,
          code: "VALIDATION_ERROR",
          message: "Profile image must be 2 MB or smaller",
        }),
      ),
    ).toBe("Profile image must be 2 MB or smaller");
    expect(
      profileErrorMessage(new ApiError({ status: 0, code: "NETWORK_ERROR", message: "x" })),
    ).toMatch(/offline/);
    expect(profileErrorMessage(new Error("boom"))).toMatch(/Something went wrong/);
  });
});

describe("profile showcase fields", () => {
  it("sends city, topics, gallery and certificates only when they change", () => {
    const payload = buildProfilePayload(
      {
        ...initialForm,
        city: " Cluj ",
        topics: ["Travel", "Music"],
        photos: ["/media/files/p1.jpg", "/media/files/p2.jpg"],
        certificates: [{ languageId: "en", level: "B2", title: " IELTS ", issuedYear: 2023 }],
      },
      initialForm,
    );
    expect(payload).toEqual({
      city: "Cluj",
      topics: ["Travel", "Music"],
      photos: ["/media/files/p1.jpg", "/media/files/p2.jpg"],
      certificates: [{ languageId: "en", level: "B2", title: "IELTS", issuedYear: 2023 }],
    });
  });

  it("projects certificates and an emptied city optimistically", () => {
    const next = applyProfilePatch(
      { ...profile, city: "Iasi" },
      { city: "", certificates: [{ languageId: "es", level: "A2", title: "DELE" }] },
      [{ id: "es", code: "es", name: "Spanish", flagEmoji: "🇪🇸" }],
    );
    expect(next.city).toBeNull();
    expect(next.certificates).toEqual([
      {
        id: "pending-0",
        languageId: "es",
        languageName: "Spanish",
        flagEmoji: "🇪🇸",
        level: "A2",
        title: "DELE",
        issuedYear: null,
      },
    ]);
  });
});

describe("applySettingsPatch", () => {
  it("flips only the given toggles", () => {
    const next = applySettingsPatch(profile, { showOnlineStatus: false });
    expect(next.settings).toEqual({ ...profile.settings, showOnlineStatus: false });
    expect(profile.settings.showOnlineStatus).toBe(true);
  });
});
