import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "./contexts/AuthContext";
import { AppRoutes } from "./router";
import i18n from "./i18n";

declare const __BASE_PATH__: string;

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;
