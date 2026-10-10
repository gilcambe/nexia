import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import { AuthProvider } from "./components/feature/AuthContext";
import { capturarIndicacao } from "./lib/ferramentas/cartao";

// Link de indicação (?ref=): guarda quem indicou antes do cadastro.
capturarIndicacao();


function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <BrowserRouter basename={__BASE_PATH__.replace(/\/$/, "") || "/"}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nextProvider>
  );
}

export default App;
