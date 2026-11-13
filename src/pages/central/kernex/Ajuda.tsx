import { MENU, TELAS, type TelaId } from "./regras";

// C2-F1 (PC 2, 13/11): Ajuda = mapa da Central em português simples. Cada parte diz para que serve e abre com 1 toque.
// Dúvida sobre outra coisa: o Consultor "?" fica em Marketing › Ferramentas.
export default function Ajuda({ ir }: { ir: (t: TelaId) => void }) {
  const nome = (id: TelaId) => TELAS.find((t) => t.id === id);
  return (
    <div className="kx-tela" data-testid="kx-ajuda">
      <section className="kx-bloco" style={{ marginBottom: 12 }}>
        <b>Como usar a Central</b>
        <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Quer algo novo ou uma mudança? Vá em <b>Conversar</b> e escreva do seu jeito.</li>
          <li>O que precisa de você aparece no <b>Início</b> (toque no logo KERNEX), sempre com o passo a passo.</li>
          <li>Ficou com dúvida? Use o <b>Consultor ?</b> em Marketing › Ferramentas.</li>
        </ol>
        <button type="button" className="kx-btn" style={{ marginTop: 10, alignSelf: "start" }} onClick={() => ir("ferramentas")} data-testid="kx-ajuda-consultor">Abrir o Consultor ?</button>
      </section>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {MENU.filter((g) => g.id !== "ajuda").map((g) => (
          <section key={g.id} className="kx-bloco" data-testid={"kx-ajuda-" + g.id}>
            <b style={{ marginBottom: 6 }}>{g.nome}</b>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
              {g.telas.map((id) => {
                const t = nome(id);
                return t ? (
                  <li key={id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ flex: 1, whiteSpace: "normal" }}><b>{t.nome}:</b> <span className="kx-mut" style={{ whiteSpace: "normal" }}>{t.serve}</span></span>
                    <button type="button" className="kx-btn" style={{ minHeight: 30 }} onClick={() => ir(id)}>Abrir</button>
                  </li>
                ) : null;
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
