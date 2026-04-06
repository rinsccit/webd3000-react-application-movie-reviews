import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Finds the H.T.M.L container where React should draw the whole interface
const rootElement = document.getElementById('root')

if (!rootElement) {
	throw new Error('Unable to find root element.')
}

// Starts the React application and enables routing between webpages
createRoot(rootElement).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
)
