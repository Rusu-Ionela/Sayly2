import "dotenv/config";

import { eq } from "drizzle-orm";

import { closeDb, db } from "../src/db/client";
import { profiles, userLanguages, users } from "../src/db/schema";

const email = "onboarding.test@sayly.test";
const password = "sayly123";

async function main() {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    await db.delete(userLanguages).where(eq(userLanguages.userId, existing.id));
    await db.delete(profiles).where(eq(profiles.userId, existing.id));
    const [updated] = await db
      .update(users)
      .set({
        passwordHash: password,
        status: "ACTIVE",
        onboardingCompleted: false,
      })
      .where(eq(users.id, existing.id))
      .returning();

    console.log(
      JSON.stringify({
        reset: true,
        id: updated.id,
        email: updated.email,
        onboardingCompleted: updated.onboardingCompleted,
      }),
    );
    return;
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: password,
      displayName: "Onboarding Test",
      authProvider: "EMAIL",
      status: "ACTIVE",
      onboardingCompleted: false,
    })
    .returning();

  console.log(
    JSON.stringify({
      created: true,
      id: created.id,
      email: created.email,
      onboardingCompleted: created.onboardingCompleted,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
