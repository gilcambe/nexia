# Estado do projeto e memória (para qualquer IA continuar)

Atualizado em 26/10/2026. Complementa `docs/CONTEXTO-IA.md` (regras). A Central junta os dois arquivos com a fila do Cortex ao vivo no botão **📦 Continuar em outra IA** (aba 🧠 Cortex). **Nunca coloque chave ou senha aqui.**

## Foco atual
- **Body Coach** é o produto para vender agora: https://nexiabodycoach.pages.dev (PWA, nada de dado falso). Play Store: conta paga, esperando verificação do Google; precisa de 12 testadores.
- **Cortex** vai virar produto vendido (planos baratos em reais). Custo de IA alvo ~R$ 0,0035 por mensagem.
- Marca pública **Kernex**; nomes internos seguem `nexia`.

## Como o trabalho é dividido
- **Escada obrigatória:** 1) Cortex; 2) IAs grátis ajudantes (Jules, Gemini CLI); 3) Claude Code só se a cota grátis do dia acabou, e ele se retira quando a cota volta. Ver `docs/ESCADA-IA.md`.
- O Cortex escreve o código (issues `cortex-fila`, cada uma com menos de 4.000 letras; diga "Copie EXATAMENTE" quando passar código pronto).
- Tarefas grandes podem ir para o Jules (grátis) pelo auto-Jules do Cortex.
- Claude (ou outra IA) só revisa PRs, testa e escreve código quando o Cortex falhou.
- Mesclar sozinho só com rótulo `automerge`, CI verde, ramo `nexia/*`.
- Precisa da palavra do dono: regras do Firestore, chaves reais, reescrever histórico, apagar dados, qualquer coisa irreversível.

## Regras do dono que já causaram problema
- Nada pago, nunca (sem Blaze, Workers Pago, Cloud Run, Render, cartão).
- O Cortex nunca para por falta de IA (cadeia de IAs grátis) e nunca espera tempo fixo.
- Ícone de cada app = inicial/logo do próprio produto; Kernex só na vinheta de 2 s.
- O dono não usa Telegram. Escreve em português, é leigo: passo a passo curto.
- Não insistir em trocar chaves expostas (o dono recusou).
- Todo projeto termina com teste completo "como pessoa".
- Não criar várias contas no mesmo provedor de IA (risco de banimento); prefira provedores diferentes.

## Clientes e sites
- Bezsan (dono Gilmar) e Studio Lima (dona Carol), sites grátis em `nome.pages.dev`. Suporte do admin entra em todo painel.
- Adriano Blumer (nutricionista): só landing. O WhatsApp dele é real: nunca mandar mensagem nem testar.
- Antigos: CES (`/ces`), Viajante Pro (`/vp`), Splash (`/splash`).

## Trabalho aberto importante (26/10)
- IA própria do Cortex: #1823 (IA no aparelho), #1824 (cache), #1825 (contador de tokens), #1787 (medidor de custo, partes #1805-#1809), #1788 (Ollama do PC como reserva).
- Teste humano do Cortex: nota 7,4; abertas #1815 (quedas), #1733 (busca), #1639 (foto), #1816 (markdown).
- Venda do Cortex: #1629-#1644 e #1581-#1589. Falta CNPJ e IA paga por uso.
- Instagram Body Coach: plano de 30 dias, #1481-#1483.

## Onde está o resto
- Issues e PRs do GitHub = diário de tudo.
- `nexia-audit/` = relatórios, planos e guias por assunto.
