import { useState, useEffect } from 'react'
import { useCoreWorkflow } from '../context/CoreWorkflowContext'
import { useDraftModule } from '../context/DraftContext'
import CoreWorkflowNav from '../components/CoreWorkflowNav'
import { PageShell, PageHeader } from '../components/layout/PageShell'

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
    <PageShell>
      <CoreWorkflowNav stepId="mail" canProceed proceedLabel="Continue to Launch" />

      <PageHeader
        title="Curi Mail"
        description="Email sequences are optional in the core workflow. Skip this step or preview a draft from your saved content."
      />

      <div className="page-card space-y-4">
        <div className="flex items-center gap-2">
          <span className="badge bg-curi-yellow/15 text-curi-yellow">Optional</span>
          <span className="text-base text-theme-muted/60">Full email automation coming soon</span>
        </div>

        {workflow.contentText ? (
          <div>
            <div className="section-label mb-3">Draft from Curi Create</div>
            <pre className="bg-theme-subtle/5 rounded-xl p-5 text-base text-theme-text/80 whitespace-pre-wrap border border-theme-border/50 font-sans leading-relaxed">
              {preview}
            </pre>
          </div>
        ) : (
          <p className="text-theme-muted/60 text-base">
            No saved content yet. Go back to Create to generate a post, or skip to Launch to build a full campaign.
          </p>
        )}
      </div>
    </PageShell>
  )
}
