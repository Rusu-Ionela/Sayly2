/** Thin facade so controllers and tests depend on the service, not persistence. */
export {
  approveMember,
  changeRole,
  createGroup,
  deleteGroup,
  getGroupDetail,
  joinGroup,
  leaveGroup,
  listGroupMessages,
  listGroups,
  listMembers,
  markGroupRead,
  removeMember,
  transferOwnership,
  updateGroup,
} from "./repository";

import { recordActivityInBackground } from "../streaks";

import * as repository from "./repository";

/** A new group message also counts the sender's day for their streak. */
export async function sendGroupMessage(...args: Parameters<typeof repository.sendGroupMessage>) {
  const result = await repository.sendGroupMessage(...args);
  if (result.created) {
    recordActivityInBackground(args[0]);
  }
  return result;
}
