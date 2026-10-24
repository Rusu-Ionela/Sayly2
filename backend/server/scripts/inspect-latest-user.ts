import "dotenv/config";

import { asc, desc } from "drizzle-orm";

import { closeDb, db } from "../src/db/client";

async function main() {
  const user = await db.query.users.findFirst({
    orderBy: (table) => [desc(table.createdAt)],
    with: {
      profile: true,
      languages: {
        with: { language: true },
        orderBy: (table) => [asc(table.type), asc(table.languageId)],
      },
    },
  });

  if (!user) {
    console.log("No users found.");
    return;
  }

  const spoken = user.languages
    .filter((row) => row.type === "SPEAKS")
    .map((row) => ({
      code: row.language.code,
      name: row.language.name,
      proficiency: row.proficiencyLevel,
    }));

  const learning = user.languages
    .filter((row) => row.type === "LEARNING")
    .map((row) => ({
      code: row.language.code,
      name: row.language.name,
      proficiency: row.proficiencyLevel,
    }));

  const photo = user.profile?.profileImageUrl ?? null;
  const photoPreview = photo
    ? photo.startsWith("data:")
      ? `data-url (${photo.length} chars)`
      : photo.length > 80
        ? `${photo.slice(0, 80)}…`
        : photo
    : null;

  const result = {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    isOnboarded: user.onboardingCompleted,
    displayName: user.profile?.displayName ?? null,
    country: user.profile?.country ?? null,
    dateOfBirth: user.profile?.dateOfBirth ?? null,
    age: user.profile?.age ?? null,
    profilePhoto: photoPreview,
    practiceGoals: user.profile?.practiceGoals ?? [],
    spokenLanguages: spoken,
    learningLanguages: learning,
    checks: {
      hasDisplayName: Boolean(user.profile?.displayName?.trim()),
      hasCountry: Boolean(user.profile?.country?.trim()),
      hasDateOfBirth: Boolean(user.profile?.dateOfBirth),
      hasProfilePhoto: Boolean(photo),
      hasSpokenLanguages: spoken.length > 0,
      hasLearningLanguages: learning.length > 0,
      onboardingFlagSet: user.onboardingCompleted === true,
      profileRowExists: Boolean(user.profile),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
