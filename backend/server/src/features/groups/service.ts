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
  sendGroupMessage,
  transferOwnership,
  updateGroup,
} from "./repository";
