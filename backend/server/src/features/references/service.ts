import { AppError } from "../../shared/errors/AppError";
import { logger } from "../../shared/utils/logger";
import { assertVisibleMember } from "../users/memberSummary";

import * as referencesRepository from "./repository";
import type { MyReferenceDto, ReferencesPageDto, SaveReferenceInput } from "./types";

/** A member's references: your own, or anyone's whose profile you can see. */
export async function listReferences(
  viewerId: string,
  subjectId: string,
  page: number,
): Promise<ReferencesPageDto> {
  const isSelf = viewerId === subjectId;
  // Same rule as the public profile: 404 when it would 404 (inactive, unfinished, blocked).
  if (!isSelf) {
    await assertVisibleMember(viewerId, subjectId);
  }

  const [{ items, hasMore }, summary, mine] = await Promise.all([
    referencesRepository.listReferencesPage(viewerId, subjectId, page),
    referencesRepository.summarizeReferences(subjectId, viewerId),
    isSelf ? null : referencesRepository.findMine(viewerId, subjectId),
  ]);
  const canWrite =
    !isSelf && (mine !== null || (await referencesRepository.haveExchangedMessages(viewerId, subjectId)));

  return { summary, items, page, hasMore, canWrite, mine };
}

/** Leave or edit your reference. Both of you must have written in your chat first. */
export async function saveReference(
  authorId: string,
  subjectId: string,
  input: SaveReferenceInput,
): Promise<MyReferenceDto> {
  if (authorId === subjectId) {
    throw new AppError("You cannot write a reference for yourself", 400, "VALIDATION_ERROR");
  }
  await assertVisibleMember(authorId, subjectId);

  if (!(await referencesRepository.haveExchangedMessages(authorId, subjectId))) {
    throw new AppError(
      "Chat with this person first. Both of you need to have sent a message.",
      403,
      "FORBIDDEN",
    );
  }

  const saved = await referencesRepository.upsertReference(authorId, subjectId, input);
  logger.info("references", "reference saved", { referenceId: saved.id, rating: saved.rating });
  return saved;
}

/** Withdraw your reference. Always allowed, even after a block. */
export async function deleteReference(authorId: string, subjectId: string) {
  await referencesRepository.deleteReference(authorId, subjectId);
  return { deleted: true as const };
}
