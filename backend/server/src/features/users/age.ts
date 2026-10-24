export function ageFromDateOfBirth(dateOfBirth: Date, now = new Date()): number {
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();
  const birthYear = dateOfBirth.getUTCFullYear();
  const birthMonth = dateOfBirth.getUTCMonth();
  const birthDay = dateOfBirth.getUTCDate();

  let age = todayYear - birthYear;
  if (todayMonth < birthMonth || (todayMonth === birthMonth && todayDay < birthDay)) {
    age -= 1;
  }

  return age;
}

export function parseStrictUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Age shown to people: from the date of birth so it never goes stale; the stored column is a legacy fallback. */
export function currentAge(profile: { dateOfBirth: Date | null; age: number | null }): number | null {
  return profile.dateOfBirth ? ageFromDateOfBirth(profile.dateOfBirth) : profile.age;
}
