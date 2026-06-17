import { Navigate, useParams } from 'react-router-dom'

export default function DesignCanvas() {
  const { designId } = useParams()
  if (designId) return <Navigate to={`/design/studio/${designId}?step=3&panel=text`} replace />
  return <Navigate to="/design/studio?step=3&panel=text" replace />
}
