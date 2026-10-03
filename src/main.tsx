import { createRoot } from 'react-dom/client'
import App from './App'
import Admin from './Admin'
import './index.css'
createRoot(document.getElementById('root')!).render(location.pathname.startsWith('/admin') ? <Admin /> : <App />)
