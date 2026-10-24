import type { EditProfileFormValues } from "../schema";
import type { UpdateProfilePayload } from "../types";

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Builds the PUT /users/me/profile body from the edit form: only fields that differ from
 * what the server last returned are sent (an unchanged avatar is never re-uploaded), and
 * spoken + learning languages travel together because the API replaces them as a pair.
 */
export function buildProfilePayload(
  values: EditProfileFormValues,
  initial: EditProfileFormValues,
): UpdateProfilePayload {
  const payload: UpdateProfilePayload = {};

  const displayName = values.displayName.trim();
  if (displayName !== initial.displayName.trim()) payload.displayName = displayName;

  const bio = values.bio.trim();
  if (bio !== initial.bio.trim()) payload.bio = bio;

  if (values.country !== initial.country) payload.country = values.country.trim();

  const city = values.city.trim();
  if (city !== initial.city.trim()) payload.city = city;

  const dateOfBirth = values.dateOfBirth.trim();
  // The API cannot clear a date of birth, so an emptied field is simply not sent.
  if (dateOfBirth && dateOfBirth !== initial.dateOfBirth) payload.dateOfBirth = dateOfBirth;

  const avatar = values.avatarUrl?.trim() ?? "";
  if (avatar !== (initial.avatarUrl?.trim() ?? "")) payload.avatarUrl = avatar || null;

  if (!sameJson(values.practiceGoals, initial.practiceGoals)) {
    payload.practiceGoals = values.practiceGoals;
  }
  if (!sameJson(values.topics, initial.topics)) payload.topics = values.topics;
  if (!sameJson(values.photos, initial.photos)) payload.photos = values.photos;
  if (!sameJson(values.certificates, initial.certificates)) {
    payload.certificates = values.certificates.map((item) => ({
      ...item,
      title: item.title.trim(),
    }));
  }

  if (
    !sameJson(values.spokenLanguages, initial.spokenLanguages) ||
    !sameJson(values.learningLanguages, initial.learningLanguages)
  ) {
    payload.spokenLanguages = values.spokenLanguages;
    payload.learningLanguages = values.learningLanguages;
  }

  return payload;
}
