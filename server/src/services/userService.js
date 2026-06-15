const crypto = require('crypto');
const User = require('../models/User');
const Workspace = require('../models/Workspace');

const generateInviteToken = () => crypto.randomBytes(24).toString('hex');

const acceptPendingInvite = async (user, inviteToken) => {
  if (!inviteToken) return null;

  const workspace = await Workspace.findOne({ 'pendingInvites.token': inviteToken });
  if (!workspace) return null;

  const invite = workspace.pendingInvites.find(i => i.token === inviteToken);
  if (!invite || invite.email !== user.email) return null;

  const alreadyMember = workspace.members.some(m => String(m.user) === String(user._id));
  if (!alreadyMember) {
    workspace.members.push({
      user: user._id,
      role: invite.role,
      invitedAt: invite.invitedAt,
      acceptedAt: new Date(),
    });
  }

  workspace.pendingInvites = workspace.pendingInvites.filter(i => i.token !== inviteToken);
  await workspace.save();

  user.currentWorkspace = workspace._id;
  await user.save();

  return workspace;
};

const addMemberToWorkspace = async ({ workspace, user, role, invitedBy }) => {
  const exists = workspace.members.some(m => String(m.user) === String(user._id));
  if (!exists) {
    workspace.members.push({
      user: user._id,
      role: role || 'editor',
      invitedAt: new Date(),
      acceptedAt: new Date(),
    });
    await workspace.save();
  }

  if (!user.currentWorkspace) {
    user.currentWorkspace = workspace._id;
    await user.save();
  }

  return { workspace, user, invitedBy };
};

const createWorkspaceUser = async ({ workspace, ownerId, name, email, password, role = 'editor' }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error('A user with this email already exists');
    err.status = 409;
    throw err;
  }

  const user = await User.create({ name, email, password });
  await addMemberToWorkspace({
    workspace,
    user,
    role,
    invitedBy: ownerId,
  });

  return user;
};

const inviteUserByEmail = async ({ workspace, ownerId, email, role = 'editor' }) => {
  const normalized = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalized });

  if (existingUser) {
    if (String(workspace.owner) === String(existingUser._id)) {
      const err = new Error('This user is already the workspace owner');
      err.status = 400;
      throw err;
    }
    await addMemberToWorkspace({
      workspace,
      user: existingUser,
      role,
      invitedBy: ownerId,
    });
    return { type: 'added', user: existingUser };
  }

  const duplicateInvite = workspace.pendingInvites?.find(i => i.email === normalized);
  if (duplicateInvite) {
    duplicateInvite.role = role;
    duplicateInvite.invitedAt = new Date();
    await workspace.save();
    return { type: 'invite-resent', email: normalized, token: duplicateInvite.token };
  }

  const token = generateInviteToken();
  workspace.pendingInvites = workspace.pendingInvites || [];
  workspace.pendingInvites.push({
    email: normalized,
    role,
    token,
    invitedBy: ownerId,
    invitedAt: new Date(),
  });
  await workspace.save();

  return { type: 'invited', email: normalized, token };
};

const listWorkspaceUsers = async (workspace) => {
  const memberIds = workspace.members.map(m => m.user).filter(Boolean);
  const users = await User.find({ _id: { $in: [workspace.owner, ...memberIds] } }).select('name email plan lastActiveAt createdAt');

  const owner = users.find(u => String(u._id) === String(workspace.owner));
  const members = workspace.members
    .filter(m => m.acceptedAt)
    .map(m => {
      const user = users.find(u => String(u._id) === String(m.user));
      if (!user) return null;
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: m.role,
        lastActiveAt: user.lastActiveAt,
        joinedAt: m.acceptedAt,
        isOwner: false,
      };
    })
    .filter(Boolean);

  return {
    owner: owner ? {
      _id: owner._id,
      name: owner.name,
      email: owner.email,
      plan: owner.plan,
      role: 'owner',
      lastActiveAt: owner.lastActiveAt,
      joinedAt: owner.createdAt,
      isOwner: true,
    } : null,
    members,
    pendingInvites: (workspace.pendingInvites || []).map(i => ({
      email: i.email,
      role: i.role,
      invitedAt: i.invitedAt,
      inviteLink: `/auth/register?invite=${i.token}`,
    })),
  };
};

module.exports = {
  acceptPendingInvite,
  addMemberToWorkspace,
  createWorkspaceUser,
  inviteUserByEmail,
  listWorkspaceUsers,
  generateInviteToken,
};
