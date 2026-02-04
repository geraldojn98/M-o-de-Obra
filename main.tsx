import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // Vizinho de porta
import './index.css' // Se não tiver esse arquivo, apague esta linha

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)