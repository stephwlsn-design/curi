import { Navigate, useSearchParams } from 'react-router-dom'

export default function SavedDesigns() {
  const [params] = useSearchParams()
  const step = params.get('step') || '2'
  return <Navigate to={`/design/studio?step=${step}&panel=saved`} replace />
}
