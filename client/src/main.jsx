import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { CoreWorkflowProvider } from './context/CoreWorkflowContext'
import { DraftProvider } from './context/DraftContext'
import './styles/globals.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } } })

function ThemedToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: '',
        style: {
          background: 'rgb(var(--theme-card))',
          color: 'rgb(var(--theme-text))',
          border: '1px solid rgb(var(--theme-border) / 0.5)',
          borderRadius: '1rem',
          fontWeight: 600,
        },
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CoreWorkflowProvider>
              <DraftProvider>
                <App />
                <ThemedToaster />
              </DraftProvider>
            </CoreWorkflowProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
