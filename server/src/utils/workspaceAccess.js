const Workspace = require('../models/Workspace');

const workspaceAccessFilter = (userId) => ({
  $or: [
    { owner: userId },
    { members: { $elemMatch: { user: userId, acceptedAt: { $ne: null } } } },
  ],
});

const findAccessibleWorkspace = async (workspaceId, userId) => {
  const filter = workspaceAccessFilter(userId);
  if (workspaceId) filter._id = workspaceId;
  return Workspace.findOne(filter);
};

const findOwnedWorkspace = async (workspaceId, userId) => {
  const filter = { owner: userId };
  if (workspaceId) filter._id = workspaceId;
  return Workspace.findOne(filter);
};

const isWorkspaceOwner = (workspace, userId) => String(workspace.owner) === String(userId);

const getMemberRole = (workspace, userId) => {
  if (isWorkspaceOwner(workspace, userId)) return 'owner';
  const member = workspace.members?.find(m => String(m.user) === String(userId) && m.acceptedAt);
  return member?.role || null;
};

module.exports = {
  workspaceAccessFilter,
  findAccessibleWorkspace,
  findOwnedWorkspace,
  isWorkspaceOwner,
  getMemberRole,
};
