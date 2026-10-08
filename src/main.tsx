import { createRoot } from 'react-dom/client'
import App from './App'
import Admin from './Admin'
import './index.css'
createRoot(document.getElementById('root')!).render(location.pathname.startsWith('/admin') ? <Admin /> : <App />)

// Alkalmazásként telepíthető + offline indulás (csak az élesített oldalon, HTTPS-en)
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
