// NEXIA — Ponte Google (grátis). Cole este código em script.google.com (veja google/LEIA-ME.md).
// Roda na SUA conta Google e só responde a quem souber o segredo abaixo.
// Ações: agenda_listar, agenda_criar, drive_buscar, drive_ler.

const SEGREDO = 'TROQUE-ESTE-TEXTO-POR-UMA-SENHA-LONGA';

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return resposta({ ok: false, erro: 'Pedido inválido.' }); }
  if (!b || b.segredo !== SEGREDO || SEGREDO.indexOf('TROQUE') === 0) return resposta({ ok: false, erro: 'Segredo errado ou não trocado.' });
  try {
    switch (b.acao) {
      case 'ping': return resposta({ ok: true, usuario: Session.getActiveUser().getEmail() || 'conectado' });
      case 'agenda_listar': return resposta({ ok: true, eventos: agendaListar(b) });
      case 'agenda_criar': return resposta({ ok: true, evento: agendaCriar(b) });
      case 'drive_buscar': return resposta({ ok: true, arquivos: driveBuscar(b) });
      case 'drive_ler': return resposta({ ok: true, texto: driveLer(b) });
      default: return resposta({ ok: false, erro: 'Ação desconhecida.' });
    }
  } catch (err) {
    return resposta({ ok: false, erro: String(err && err.message || err).slice(0, 200) });
  }
}

// Rode esta função uma vez no editor para o Google pedir as permissões (Agenda, Drive, Documentos, Planilhas).
function autorizar() {
  CalendarApp.getDefaultCalendar().getName();
  DriveApp.getRootFolder().getName();
  DocumentApp.getActiveDocument;
  SpreadsheetApp.getActive;
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function agendaListar(b) {
  const dias = Math.min(Math.max(Number(b.dias) || 7, 1), 60);
  const ini = new Date();
  const fim = new Date(ini.getTime() + dias * 86400000);
  return CalendarApp.getDefaultCalendar().getEvents(ini, fim).slice(0, 50).map(function (ev) {
    return { titulo: ev.getTitle(), inicio: ev.getStartTime().toISOString(), fim: ev.getEndTime().toISOString(), diaInteiro: ev.isAllDayEvent(), local: ev.getLocation() || '' };
  });
}

function agendaCriar(b) {
  const titulo = String(b.titulo || '').slice(0, 200);
  const ini = new Date(b.inicio);
  if (!titulo || isNaN(ini.getTime())) throw new Error('Precisa de título e data/hora válidos.');
  const fim = b.fim ? new Date(b.fim) : new Date(ini.getTime() + 3600000);
  const ev = CalendarApp.getDefaultCalendar().createEvent(titulo, ini, fim, { description: String(b.descricao || '').slice(0, 2000) });
  return { titulo: ev.getTitle(), inicio: ev.getStartTime().toISOString(), fim: ev.getEndTime().toISOString() };
}

function driveBuscar(b) {
  const termo = String(b.termo || '').replace(/['\\]/g, ' ').slice(0, 100);
  if (!termo.trim()) throw new Error('Diga o que procurar.');
  const it = DriveApp.searchFiles("title contains '" + termo + "' or fullText contains '" + termo + "'");
  const lista = [];
  while (it.hasNext() && lista.length < 10) {
    const f = it.next();
    lista.push({ id: f.getId(), nome: f.getName(), tipo: f.getMimeType(), atualizado: f.getLastUpdated().toISOString(), link: f.getUrl() });
  }
  return lista;
}

function driveLer(b) {
  const f = DriveApp.getFileById(String(b.id));
  const tipo = f.getMimeType();
  let texto = '';
  if (tipo === MimeType.GOOGLE_DOCS) texto = DocumentApp.openById(f.getId()).getBody().getText();
  else if (tipo === MimeType.GOOGLE_SHEETS) {
    const aba = SpreadsheetApp.openById(f.getId()).getSheets()[0];
    texto = aba.getDataRange().getValues().slice(0, 100).map(function (l) { return l.join(' | '); }).join('\n');
  } else if (tipo.indexOf('text/') === 0) texto = f.getBlob().getDataAsString();
  else throw new Error('Só leio Google Docs, Planilhas e arquivos de texto.');
  return texto.slice(0, 6000);
}
