
/* Entry point for the MovieReviews React web application.
   This file finds the root H.T.M.L element and tells React to render the application there.
   It also enables routing so users can move between webpages. */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Find the H.T.M.L element where React should render the application (with id="root")
const rootElement = document.getElementById("root");

if (!rootElement) {
	// If the root element is missing then stop and show an error
	throw new Error("Unable to find root element.");
}

// Start the React application and enable routing between webpages
createRoot(rootElement).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
