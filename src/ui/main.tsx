import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { NotificationProvider } from './context/NotificationContext'
import { Toaster } from 'react-hot-toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <DataProvider>
          <NotificationProvider>
            <App />
            <Toaster 
              position="bottom-right" 
              toastOptions={{
                className: 'dark:!bg-[#1e2125] dark:!text-[#f5f5f5]',
              }}
            />

          </NotificationProvider>
        </DataProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
