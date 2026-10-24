import { hash, verify } from "argon2";

let dummyHashPromise: Promise<string> | null = null;

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function dummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("timing-equalization-placeholder");
  }
  return dummyHashPromise;
}

export async function verifyPasswordOrDummy(
  passwordHash: string | null | undefined,
  password: string,
): Promise<boolean> {
  if (!passwordHash) {
    await verifyPassword(await dummyPasswordHash(), password);
    return false;
  }
  return verifyPassword(passwordHash, password);
}
