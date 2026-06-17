import { Navigate, useSearchParams } from 'react-router-dom'

export default function DesignTemplates() {
  const [params] = useSearchParams()
  const step = params.get('step') || '1'
  return <Navigate to={`/design/studio?step=${step}&panel=templates`} replace />
}
