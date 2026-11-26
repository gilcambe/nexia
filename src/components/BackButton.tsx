import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";

/**
 * BackButton
 *
 * Renders a simple "Voltar" button that appears on every screen
 * except the home screen. The button uses the browser history
 * to navigate back. It also works with the Android back button
 * because BrowserRouter already listens to the popstate event.
 */
export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Define the paths that represent the home screen.
  // Adjust this list if your app has multiple home routes.
  const homePaths = ["/", "/home"];

  // If we are on a home path, do not render the button.
  if (homePaths.includes(location.pathname)) {
    return null;
  }

  // Optional: ensure that the history stack has a previous entry.
  // If not, the button will still call navigate(-1) which will
  // simply do nothing (the app will stay on the current page).
  const canGoBack = window.history.length > 1;

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      disabled={!canGoBack}
      style={{
        position: "fixed",
        top: "1rem",
        left: "1rem",
        zIndex: 1000,
        background: "transparent",
        border: "none",
        color: "#007bff",
        fontSize: "1rem",
        cursor: "pointer",
      }}
      aria-label="Voltar"
    >
      ← Voltar
    </button>
  );
}
