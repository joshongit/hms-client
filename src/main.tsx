import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LogtoProvider } from '@logto/react'
import type { LogtoConfig } from '@logto/react'
import './index.css'
import App from './App.tsx'

const config: LogtoConfig = {
  endpoint: 'https://5dffq2.logto.app',
  appId: '1uqz2f01b42wmoqhtppo8',
  scopes: ['openid', 'profile', 'offline_access', 'email'],
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LogtoProvider config={config}>
      <App />
    </LogtoProvider>
  </StrictMode>,
)
