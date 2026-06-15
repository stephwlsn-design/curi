const express = require('express');
const router = express.Router();
const WorkflowDraft = require('../models/WorkflowDraft');
const Content = require('../models/Content');
const { findAccessibleWorkspace } = require('../utils/workspaceAccess');

const buildTitle = (payload) => {
  if (payload.title?.trim()) return payload.title.trim().slice(0, 120)
  const topic = payload.coreWorkflow?.topic || payload.modules?.create?.topic
  if (topic) return `${topic.slice(0, 60)} — Draft`
  const step = payload.currentStep || 'workflow'
  return `Curi ${step.charAt(0).toUpperCase() + step.slice(1)} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

const collectContentRefs = (modules = {}) => {
  const refs = []
  const push = (items, module, type) => {
    if (!Array.isArray(items)) return
    items.forEach(item => {
      if (item?._id) refs.push({ contentId: item._id, module, type })
    })
  }
  if (modules.create?.result?._id) {
    refs.push({ contentId: modules.create.result._id, module: 'create', type: 'post' })
  }
  push(modules.design?.designs, 'design', 'image')
  push(modules.video?.videos, 'video', 'video')
  if (modules.launch?.campaignId) {
    refs.push({ contentId: modules.launch.campaignId, module: 'launch', type: 'campaign' })
  }
  return refs
}

router.get('/', async (req, res) => {
  const { workspaceId } = req.query
  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id)
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' })

  const drafts = await WorkflowDraft.find({
    workspace: workspaceId,
    createdBy: req.user._id,
    status: 'draft',
  }).sort({ updatedAt: -1 }).limit(50)

  res.json({ drafts })
})

router.get('/:id', async (req, res) => {
  const draft = await WorkflowDraft.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
  })
  if (!draft) return res.status(404).json({ error: 'Draft not found' })
  res.json({ draft })
})

router.post('/save', async (req, res) => {
  const {
    workspaceId, draftId, title, currentStep, currentPath,
    coreWorkflow, modules,
  } = req.body

  const workspace = await findAccessibleWorkspace(workspaceId, req.user._id)
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' })

  const payload = {
    title: buildTitle({ title, coreWorkflow, modules, currentStep }),
    currentStep: currentStep || 'discover',
    currentPath: currentPath || '/discover',
    coreWorkflow: coreWorkflow || {},
    modules: modules || {},
    contentRefs: collectContentRefs(modules),
  }

  let draft
  if (draftId) {
    draft = await WorkflowDraft.findOneAndUpdate(
      { _id: draftId, workspace: workspaceId, createdBy: req.user._id },
      { $set: payload },
      { new: true }
    )
  }

  if (!draft) {
    draft = await WorkflowDraft.create({
      workspace: workspaceId,
      createdBy: req.user._id,
      ...payload,
    })
  }

  const contentIds = payload.contentRefs.map(r => r.contentId).filter(Boolean)
  if (contentIds.length) {
    await Content.updateMany(
      { _id: { $in: contentIds }, status: { $nin: ['published', 'scheduled'] } },
      { $set: { status: 'draft' } }
    )
  }

  res.json({ draft, message: 'Progress saved as draft' })
})

router.delete('/:id', async (req, res) => {
  const draft = await WorkflowDraft.findOneAndDelete({
    _id: req.params.id,
    createdBy: req.user._id,
  })
  if (!draft) return res.status(404).json({ error: 'Draft not found' })
  res.json({ message: 'Draft deleted' })
})

module.exports = router
