import { useState, useEffect } from 'react'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'

export default function Mail() {
  const { workflow } = useCoreWorkflow()
  const [preview, setPreview] = useState('')

  useDraftModule('mail', () => ({ preview }), (s) => {
    if (s.preview) setPreview(s.preview)
  })

  useEffect(() => {
    if (workflow.contentText) {
      setPreview(`Subject: ${workflow.topic || 'Your campaign update'}\n\nHi there,\n\n${workflow.contentText.slice(0, 280)}...\n\nBest,\nYour team`)
    }
  }, [workflow.contentText, workflow.topic])

  return (
    <div className="p-8 max-w-3xl">
      <CoreWorkflowNav stepId="mail" canProceed proceedLabel="Continue to Launch" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-theme-text mb-2">Curi Mail</h1>
        <p className="text-theme-muted/50">
          Email sequences are optional in the core workflow. Skip this step or preview a draft from your saved content.
        </p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="badge bg-curi-yellow/15 text-curi-yellow">Optional</span>
          <span className="text-sm text-theme-muted/50">Full email automation coming soon</span>
        </div>

        {workflow.contentText ? (
          <div>
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider mb-2">Draft from Curi Create</div>
            <pre className="bg-theme-subtle/5 rounded-xl p-4 text-sm text-theme-text/80 whitespace-pre-wrap border border-theme-border/50 font-sans leading-relaxed">
              {preview}
            </pre>
          </div>
        ) : (
          <p className="text-theme-muted/50 text-sm">
            No saved content yet. Go back to Create to generate a post, or skip to Launch to build a full campaign.
          </p>
        )}
      </div>
    </div>
  )
}
