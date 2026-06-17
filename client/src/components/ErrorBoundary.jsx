import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Curi] UI error:', error, info)
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-8">
          <div className="page-card max-w-md text-center space-y-4">
            <img src="/images/curi-mascot.png" alt="" className="w-20 h-20 mx-auto object-contain" />
            <h1 className="text-lg font-bold text-theme-text">Something went wrong</h1>
            <p className="text-sm text-theme-muted/60 break-words">{error.message}</p>
            <p className="text-xs text-theme-muted/45">
              If this error mentions an old variable name, clear site cache: open DevTools → Network → check “Disable cache”, then Cmd+Shift+R.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
