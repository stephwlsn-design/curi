const { connectDB } = require('../config/database');
const {
  getQueue,
  submitForReview,
  approveContent,
  rejectContent,
  scheduleContent,
} = require('../services/approvalService');

const getApprovalQueue = async ({ user, workspaceId, status }) => {
  await connectDB();
  return getQueue({ workspaceId, userId: user._id, status });
};

const submitContentForReview = async ({ user, contentId, workspaceId }) => {
  await connectDB();
  const item = await submitForReview({ contentId, workspaceId, userId: user._id });
  return { item };
};

const approveQueueItem = async ({ user, contentId, workspaceId, schedule }) => {
  await connectDB();
  const item = await approveContent({
    contentId,
    workspaceId,
    userId: user._id,
    schedule: schedule !== false,
  });
  return { item };
};

const rejectQueueItem = async ({ user, contentId, workspaceId, reason }) => {
  await connectDB();
  const item = await rejectContent({
    contentId,
    workspaceId,
    userId: user._id,
    reason,
  });
  return { item };
};

const publishQueueItem = async ({ user, contentId, workspaceId, scheduledAt }) => {
  await connectDB();
  const item = await scheduleContent({
    contentId,
    workspaceId,
    userId: user._id,
    scheduledAt,
  });
  return { item };
};

module.exports = {
  getApprovalQueue,
  submitContentForReview,
  approveQueueItem,
  rejectQueueItem,
  publishQueueItem,
};
