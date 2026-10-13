import { avisarQuePaguei, PRECOS, type Acesso } from '@/lib/acesso';

// Preços e pagamento por Pix (chave do NEXIA) com o aviso "Já paguei" para o admin conferir.
export default function PagarPix({ acesso, avisar }: { acesso: Acesso; avisar: (msg: string) => void }) {
  const coach = acesso.tipo === 'coach';
  const copiar = async () => { try { await navigator.clipboard.writeText(acesso.pix); avisar('Chave Pix copiada! Cole no app do seu banco.'); } catch { avisar('Não consegui copiar. Segure a chave e copie.'); } };
  const paguei = async () => { try { await avisarQuePaguei(); avisar('Recebemos o seu aviso! Assim que o Pix for confirmado, o app libera sozinho.'); } catch (e) { avisar((e as Error).message); } };
  return (
    <>
        <div className="space-y-2 rounded-xl bg-background-100 p-3 text-left text-sm text-foreground-700">
          {coach ? (
            <>
              {PRECOS.faixas.map((f) => <p key={f.faixa}><b>{f.nome}:</b> {f.alunos}, {f.preco} (alunos não pagam)</p>)}
              <p><b>Coach Parceiro:</b> {PRECOS.parceiro}</p>
            </>
          ) : <p><b>Premium:</b> {PRECOS.premium}</p>}
          {acesso.pix ? (
            <>
              <p className="pt-1">Pague por Pix nesta chave:</p>
              <p className="break-all rounded-lg border border-background-200 bg-background-50 px-3 py-2 font-semibold text-foreground-900">{acesso.pix}</p>
              <button onClick={() => void copiar()} className="w-full rounded-xl border border-primary-300 py-3 text-base font-semibold text-primary-700"><i className="ri-file-copy-line mr-1"></i>Copiar chave Pix</button>
            </>
          ) : <p className="pt-1">Fale com o NEXIA para receber a chave Pix.</p>}
        </div>
      <button onClick={() => void paguei()} className="w-full rounded-xl bg-primary-500 py-3 text-base font-semibold text-background-50">Já paguei, avisar o NEXIA</button>
    </>
  );
}
