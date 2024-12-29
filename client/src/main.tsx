import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './main.css'

if (import.meta.env.VITE_PLAUSIBLE_DOMAIN && import.meta.env.VITE_PLAUSIBLE_SCRIPT) {
    const script1 = document.createElement('script')
    script1.defer = true
    script1.setAttribute('data-domain', import.meta.env.VITE_PLAUSIBLE_DOMAIN)
    script1.src = import.meta.env.VITE_PLAUSIBLE_SCRIPT
    document.head.appendChild(script1)

    const script2 = document.createElement('script')
    script2.text = `
        window.plausible = window.plausible || function() {
            (window.plausible.q = window.plausible.q || []).push(arguments)
        }`
    document.head.appendChild(script2)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
