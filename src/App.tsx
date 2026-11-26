import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { AppRoutes } from "./router";
import i18n from "./i18n";
import BackButton from "./components/BackButton";

declare const __BASE_PATH__: string;

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          {/* Back button is rendered on every route except the home screen */}
          <BackButton />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;
