import type { Dados } from "./api";
import type { Cor } from "./ui";

// O que precisa do dono agora, em frases simples. A aba diz onde resolver.
// Cada aviso traz o que aconteceu, o que isso afeta e o passo a passo (com link) para resolver.
// "conserto" = texto pronto para pedir ao Cortex quando quem resolve é o robô, não o dono.
export interface Aviso {
  cor: Cor; texto: string; aba: Aba;
  oque: string; impacto: string; passos: string[];
  link?: { rotulo: string; url: string };
  conserto?: string;
  sozinho?: boolean; // resolve sozinho, sem o dono fazer nada
}
export type Aba = "inicio" | "clientes" | "dinheiro" | "divulgar" | "cortex" | "prs" | "sistema" | "mais";

const ACOES = "https://github.com/gilcambe/nexia/actions";

export function calcularAvisos(d: Dados): Aviso[] {
  const a: Aviso[] = [];
  const produto = (id: string) => d.lista?.produtos.find((p) => p.id === id);
  const nome = (id: string) => produto(id)?.nome || id;
  for (const m of d.saude?.produtos || []) {
    const p = produto(m.id);
    const url = p?.site || "";
    if (m.ok === false) { // #2882: só com prova (2 checagens seguidas falhando); null = sem medição, sem alerta
      a.push({
        cor: "vermelho", texto: `${nome(m.id)} está fora do ar`, aba: "clientes",
        oque: `O endereço ${url} não respondeu${m.codigo ? ` (código ${m.codigo})` : ""}${m.quando ? `, na medição de ${new Date(m.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}.`,
        impacto: p?.tipo === "cliente" ? "Os clientes desse site podem não conseguir abrir a página." : "Quem usa esse produto pode não conseguir entrar.",
        passos: [
          "Toque em \"Abrir o site\" abaixo. Se abrir normal, foi uma queda rápida e já voltou: não precisa fazer nada.",
          "Se não abrir, toque em \"Pedir conserto ao Cortex\". Ele abre a tarefa e corrige; você acompanha na aba Cortex.",
          "Se continuar fora depois de 1 hora, me mande um print desta tela.",
        ],
        link: url ? { rotulo: "Abrir o site", url } : undefined,
        conserto: `${nome(m.id)} está fora do ar: ${url} não respondeu${m.codigo ? ` (código ${m.codigo})` : ""}. Descubra a causa e corrija.`,
      });
    } else if (m.ok && m.lento) {
      a.push({
        cor: "amarelo", texto: `${nome(m.id)} está lento para abrir`, aba: "clientes",
        oque: `${url} levou ${(m.tempo / 1000).toFixed(1).replace(".", ",")} s para responder (o normal é menos de 3 s).`,
        impacto: "A página abre, mas demora. Se repetir, clientes desistem.",
        passos: ["Não precisa fazer nada agora. Se aparecer de novo amanhã, toque em \"Pedir conserto ao Cortex\"."],
        link: url ? { rotulo: "Abrir o site", url } : undefined,
        conserto: `${nome(m.id)} está lento: ${url} levou ${m.tempo} ms. Ache o que deixa lento e melhore.`,
      });
    }
  }
  if (d.banco && !d.banco.ok) a.push(d.banco.cheio ? {
    cor: "vermelho", texto: "O banco de dados chegou no limite grátis de hoje", aba: "sistema",
    oque: "O Firebase grátis tem um limite de leituras por dia, e ele acabou.", impacto: "Algumas telas podem não carregar até o limite voltar.",
    passos: ["Não precisa fazer nada: o limite volta sozinho por volta das 4h (horário de Brasília).", "Enquanto isso, o banco reserva (D1) segura o que dá."], sozinho: true,
  } : {
    cor: "vermelho", texto: "O banco de dados não respondeu", aba: "sistema",
    oque: "O Firebase não respondeu na última conferência.", impacto: "Telas que leem dados podem falhar.",
    passos: ["Toque em \"Conferir agora\" daqui a 1 minuto.", "Se continuar, abra o Firebase pelo link e veja se aparece algum aviso vermelho.", "Se aparecer, me mande um print."],
    link: { rotulo: "Abrir o Firebase", url: "https://console.firebase.google.com/project/nexia-c8710" },
  });
  for (const r of d.robos?.robos || []) if (r.situacao === "erro") a.push({
    cor: "amarelo", texto: `O robô "${r.nome}" deu erro na última vez`, aba: "sistema",
    oque: `A última rodada do robô "${r.nome}" (${r.arquivo}) terminou com erro.`,
    impacto: "O que esse robô confere ou faz ficou sem fazer nesta rodada. O site continua no ar.",
    passos: [
      "Você não precisa mexer no código. Toque em \"Pedir conserto ao Cortex\": ele lê o erro e corrige.",
      "Se quiser ver o erro, toque em \"Ver a rodada com erro\" e procure o passo com ❌.",
    ],
    link: { rotulo: "Ver a rodada com erro", url: r.link || ACOES },
    conserto: `O robô ${r.arquivo} ("${r.nome}") deu erro na última rodada${r.link ? ` (${r.link})` : ""}. Leia o log, ache a causa e corrija.`,
  });
  const travadas = d.cortex?.travadas.length || 0;
  if (travadas) a.push({
    cor: "amarelo", texto: `${travadas} tarefa${travadas > 1 ? "s" : ""} do Cortex travada${travadas > 1 ? "s" : ""}`, aba: "cortex",
    oque: `${travadas} tarefa${travadas > 1 ? "s" : ""} não ${travadas > 1 ? "foram entregues" : "foi entregue"} depois de várias tentativas do Cortex.`,
    impacto: "Essas melhorias ficam paradas até alguém entregar.",
    passos: [
      "Não precisa fazer nada: a escada é automática. Primeiro o Jules, depois as IAs que você conectou, e só no fim o Claude.",
      "Para ajudar, conecte mais IAs grátis em \"IA e Infraestrutura\" → Conectar IAs.",
      "Para ver cada uma, abra a aba Cortex.",
    ],
    sozinho: true,
  });
  if (d.dinheiro?.avisos7) a.push({
    cor: "amarelo", texto: `${d.dinheiro.avisos7} aviso${d.dinheiro.avisos7 > 1 ? "s" : ""} de pagamento Pix nos últimos 7 dias (confira e libere)`, aba: "dinheiro",
    oque: "Alguém avisou que pagou por Pix.", impacto: "A pessoa espera o acesso ser liberado.",
    passos: ["Confira no app do banco se o Pix entrou.", "Abra a aba Dinheiro e toque em \"Liberar\" ao lado do nome.", "Se não entrou, toque em \"Recusar\"."],
  });
  if (d.dinheiro?.vencendo7) a.push({
    cor: "amarelo", texto: `${d.dinheiro.vencendo7} assinatura${d.dinheiro.vencendo7 > 1 ? "s vencem" : " vence"} em até 7 dias`, aba: "dinheiro",
    oque: "Assinaturas perto de vencer.", impacto: "Se não renovarem, perdem o acesso.",
    passos: ["Abra a aba Dinheiro para ver quem é.", "Se quiser, mande uma mensagem lembrando da renovação."],
  });
  for (const f of d.empresa?.fornecedores || []) if (f.situacao === "erro") a.push({
    cor: "amarelo", texto: `${f.nome} deu erro na última vez`, aba: "sistema",
    oque: `O serviço ${f.nome} (${f.paraQue}) deu erro na última vez que foi usado.`, impacto: "O que depende dele pode ter falhado nessa vez.",
    passos: ["Toque em \"Pedir conserto ao Cortex\".", "Se for chave vencida, a aba IA e Infraestrutura mostra qual trocar."],
    link: { rotulo: `Abrir ${f.nome}`, url: f.link },
    conserto: `O serviço ${f.nome} deu erro na última vez. Descubra a causa e corrija.`,
  });
  if (d.leads?.novos) a.push({
    cor: "amarelo", texto: `${d.leads.novos} contato${d.leads.novos > 1 ? "s" : ""} interessado${d.leads.novos > 1 ? "s" : ""} esperando resposta`, aba: "clientes",
    oque: "Pessoas deixaram contato nos sites.", impacto: "Quanto antes responder, maior a chance de virar cliente.",
    passos: ["Abra a aba Tenants, parte Contatos.", "Toque no WhatsApp de cada um e responda."],
  });
  const ultimo = d.divulga?.historico[0];
  if (ultimo && ultimo.resultados.length && ultimo.resultados.every((r) => !r.ok)) a.push({
    cor: "amarelo", texto: "O último post não saiu em nenhuma rede", aba: "divulgar",
    oque: "O robô Divulga tentou postar e nenhuma rede aceitou.", impacto: "O post de hoje não apareceu.",
    passos: ["Abra a aba Divulgar e veja o motivo ao lado de cada rede.", "Se for a chave da Meta, rode o configurar-meta.bat no PC."],
  });
  if (d.cloudflare && !d.cloudflare.configurado) a.push({
    cor: "cinza", texto: "Falta ligar", aba: "sistema",
    oque: "Falta a chave de leitura do Cloudflare (CLOUDFLARE_ANALYTICS_TOKEN).", impacto: "O site funciona normal; só o número de visitas do dia não aparece aqui.",
    passos: [
      "Abra https://dash.cloudflare.com/profile/api-tokens e clique Create Token.",
      "Em \"Read analytics and logs\" clique Use template (só leitura, grátis).",
      "Clique Continue to summary e Create Token. Copie o código.",
      "Abra https://dash.cloudflare.com → Workers & Pages → nexia → Settings → Variables and Secrets → Add → tipo Secret, nome CLOUDFLARE_ANALYTICS_TOKEN, cole o código, Deploy.",
      "Volte na Central e clique Conferir agora.",
    ],
    link: { rotulo: "Criar a chave no Cloudflare", url: "https://dash.cloudflare.com/profile/api-tokens" },
  });
  const peso = (x: Aviso) => (x.cor === "vermelho" ? 0 : x.cor === "amarelo" ? 1 : 2);
  return a.sort((x, y) => peso(x) - peso(y));
}
