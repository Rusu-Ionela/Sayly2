import "dotenv/config";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to run seed-demo-users in production");
}

/**
 * Upsert demo users with argon2-hashed passwords for local/dev login.
 * Usage: npx tsx scripts/seed-demo-users.ts
 */

import { eq } from "drizzle-orm";

import { db, closeDb } from "../src/db/client";
import { profiles, userLanguages, users } from "../src/db/schema";
import { hashPassword } from "../src/features/auth/password";
import { seedLanguageCatalog } from "../src/features/languages/repository";

const DEMO_PASSWORD = "sayly123";

type SeedUser = {
  email: string;
  displayName: string;
  bio: string;
  country: string;
  age: number;
  practiceGoals: string[];
  languages: Array<{ languageId: string; type: "SPEAKS" | "LEARNING"; proficiency: "NATIVE" | "INTERMEDIATE" | "BEGINNER" | "ADVANCED" }>;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "maria@sayly.test",
    displayName: "Maria Popescu",
    bio: "Romanian speaker looking for patient English conversation partners.",
    country: "Romania",
    age: 26,
    practiceGoals: ["Conversation", "Speaking", "Vocabulary"],
    languages: [
      { languageId: "ro", type: "SPEAKS", proficiency: "NATIVE" },
      { languageId: "en", type: "LEARNING", proficiency: "INTERMEDIATE" },
    ],
  },
  {
    email: "james@sayly.test",
    displayName: "James Carter",
    bio: "Native English speaker learning Romanian and Spanish for travel and culture.",
    country: "United States",
    age: 29,
    practiceGoals: ["Conversation", "Grammar", "Culture"],
    languages: [
      { languageId: "en", type: "SPEAKS", proficiency: "NATIVE" },
      { languageId: "ro", type: "LEARNING", proficiency: "BEGINNER" },
      { languageId: "es", type: "LEARNING", proficiency: "INTERMEDIATE" },
    ],
  },
  {
    email: "lucia@sayly.test",
    displayName: "Lucía Fernández",
    bio: "Spanish teacher practicing English fluency with real conversations.",
    country: "Spain",
    age: 31,
    practiceGoals: ["Speaking", "Pronunciation", "Conversation"],
    languages: [
      { languageId: "es", type: "SPEAKS", proficiency: "NATIVE" },
      { languageId: "en", type: "LEARNING", proficiency: "ADVANCED" },
    ],
  },
  {
    email: "sayly@demo.com",
    displayName: "Sayly Demo",
    bio: "Demo account for quick testing.",
    country: "Romania",
    age: 25,
    practiceGoals: ["Conversation", "Speaking"],
    languages: [
      { languageId: "ro", type: "SPEAKS", proficiency: "NATIVE" },
      { languageId: "en", type: "LEARNING", proficiency: "INTERMEDIATE" },
    ],
  },
];

async function seedLanguages() {
  await seedLanguageCatalog();
}

async function seedUser(seed: SeedUser, passwordHash: string) {
  const existing = await db.select().from(users).where(eq(users.email, seed.email)).limit(1);
  const existingUser = existing[0];

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    await db
      .update(users)
      .set({
        passwordHash,
        displayName: seed.displayName,
        bio: seed.bio,
        status: "ACTIVE",
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email: seed.email,
        passwordHash,
        displayName: seed.displayName,
        bio: seed.bio,
        status: "ACTIVE",
        onboardingCompleted: true,
      })
      .returning({ id: users.id });

    if (!created) {
      throw new Error(`Failed to create user ${seed.email}`);
    }
    userId = created.id;
  }

  await db
    .insert(profiles)
    .values({
      userId,
      displayName: seed.displayName,
      bio: seed.bio,
      country: seed.country,
      age: seed.age,
      practiceGoals: seed.practiceGoals,
      profileCompleted: true,
      profileImageUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed.displayName)}`,
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        displayName: seed.displayName,
        bio: seed.bio,
        country: seed.country,
        age: seed.age,
        practiceGoals: seed.practiceGoals,
        profileCompleted: true,
        profileImageUrl: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed.displayName)}`,
        updatedAt: new Date(),
      },
    });

  await db.delete(userLanguages).where(eq(userLanguages.userId, userId));

  if (seed.languages.length > 0) {
    await db.insert(userLanguages).values(
      seed.languages.map((item) => ({
        userId,
        languageId: item.languageId,
        type: item.type,
        proficiencyLevel: item.proficiency,
      })),
    );
  }

  console.log(`  ✓ ${seed.displayName} <${seed.email}>`);
}

async function main() {
  console.log("Seeding languages…");
  await seedLanguages();

  console.log(`Seeding demo users (password: ${DEMO_PASSWORD})…`);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const seed of SEED_USERS) {
    await seedUser(seed, passwordHash);
  }

  console.log("Done. You can log in with any of the emails above.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
