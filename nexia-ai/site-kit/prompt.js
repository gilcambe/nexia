'use strict';
// Pedido ao modelo (ADR-Q-04): só conteúdo e escolhas visuais, em JSON. Curto de propósito: cabe na
// cota por minuto dos modelos grátis numa única chamada, sem ferramentas.

const SITE_EXAMPLE = {
  kind: 'site', name: 'Sorriso Leve', tagline: 'Odontologia gentil para toda a família',
  description: 'Clínica odontológica em São Paulo com clareamento, implantes e ortodontia.',
  folder: 'demos/sorriso-leve', style: 'soft', photo_theme: 'dentist dental',
  fonts: { heading: 'Fraunces', body: 'Inter' },
  palette: { primary: '#2a7f8e', accent: '#f4a259', bg: '#f7fbfb', surface: '#ffffff', text: '#16302f', muted: '#5b6f70', dark: '#0f2e33' },
  contact: { whatsapp: '5511999998888', phone: '(11) 99999-8888', email: 'contato@sorrisoleve.com.br', address: 'Rua das Flores, 120', city: 'São Paulo - SP', hours: 'Seg a sex, 8h às 19h', instagram: 'sorrisoleve', youtube: '', tiktok: '', linkedin: '' },
  sections: [
    { type: 'hero', eyebrow: 'Clínica odontológica', title: 'Seu sorriso merece cuidado sem medo', subtitle: 'Tratamentos modernos e atendimento acolhedor.', cta: { label: 'Agendar avaliação', href: 'whatsapp' }, cta2: { label: 'Ver tratamentos', href: '#tratamentos' }, image_query: 'smiling woman dentist clinic', video_query: 'dentist' },
    { type: 'services', id: 'tratamentos', title: 'Tratamentos', subtitle: 'Do check-up à estética.', items: [{ title: 'Clareamento', text: 'Até 8 tons mais brancos.', price: 'a partir de R$ 690', image_query: 'teeth whitening' }, { title: 'Implantes', text: 'Dente fixo com segurança.', image_query: 'dental implant' }, { title: 'Ortodontia', text: 'Aparelhos fixos e invisíveis.', image_query: 'dental braces' }] },
    { type: 'about', title: 'Sobre a clínica', text: 'Há 12 anos cuidando de famílias.', image_query: 'modern dental office', stats: [{ value: '12', label: 'anos' }, { value: '8000+', label: 'pacientes' }] },
    { type: 'gallery', title: 'Nosso espaço', image_queries: ['dental office interior', 'dentist chair', 'happy patient smile', 'dental tools', 'dental hygiene', 'smiling family'], gif_queries: ['tooth brushing'] },
    { type: 'video', title: 'Conheça a clínica', subtitle: 'Um minuto por dentro do nosso consultório.', youtube: '', video_query: 'dentist patient' },
    { type: 'team', title: 'Equipe', members: [{ name: 'Dra. Ana Lima', role: 'Ortodontista', image_query: 'female dentist portrait' }] },
    { type: 'testimonials', title: 'Depoimentos', items: [{ name: 'Carla M.', text: 'Perdi o medo de dentista!', rating: 5 }, { name: 'João P.', text: 'Implante perfeito, sem dor.', rating: 5 }, { name: 'Bia R.', text: 'Equipe atenciosa demais.', rating: 5 }] },
    { type: 'links', title: 'Links rápidos', items: [{ label: 'Agendar pelo WhatsApp', url: 'https://wa.me/5511999998888', icon: 'whatsapp' }, { label: 'Instagram', url: 'https://instagram.com/sorrisoleve', icon: 'instagram' }] },
    { type: 'faq', title: 'Dúvidas frequentes', items: [{ q: 'Aceitam convênio?', a: 'Sim, os principais planos.' }, { q: 'Atendem aos sábados?', a: 'Sim, das 8h às 12h.' }, { q: 'Clareamento dói?', a: 'Pode dar sensibilidade leve por 1 a 2 dias.' }, { q: 'Parcelam?', a: 'Em até 12x no cartão.' }] },
    { type: 'cta', title: 'Agende sua avaliação', subtitle: 'Resposta rápida pelo WhatsApp.', cta: { label: 'Chamar no WhatsApp', href: 'whatsapp' } },
    { type: 'contact', title: 'Fale com a gente' },
  ],
};

const SYSTEM_EXAMPLE = {
  kind: 'system', name: 'Agenda Clínica', tagline: 'Consultas e pacientes num só lugar', folder: 'demos/agenda-clinica',
  fonts: { heading: 'Plus Jakarta Sans', body: 'Inter' }, palette: { primary: '#4f46e5', accent: '#06b6d4', dark: '#111827' },
  contact: { email: 'suporte@clinica.com.br' },
  entities: [
    { key: 'consultas', label: 'Consultas', singular: 'Consulta', fields: [
      { key: 'paciente', label: 'Paciente', type: 'text' }, { key: 'data', label: 'Data', type: 'date' }, { key: 'hora', label: 'Hora', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Agendada', 'Confirmada', 'Concluída', 'Cancelada'] },
      { key: 'valor', label: 'Valor', type: 'money' }, { key: 'obs', label: 'Observações', type: 'textarea', required: false }],
    sample: [{ paciente: 'Ana Souza', data: '2026-10-06', hora: '09:00', status: 'Confirmada', valor: '250' }, { paciente: 'Bruno Lima', data: '2026-10-06', hora: '10:30', status: 'Agendada', valor: '180' },
      { paciente: 'Carla Dias', data: '2026-10-07', hora: '14:00', status: 'Concluída', valor: '320' }, { paciente: 'Davi Reis', data: '2026-10-08', hora: '16:15', status: 'Cancelada', valor: '0' }] },
  ],
  modules: ['Agenda', 'Pacientes', 'Financeiro'],
};

const { HEADING_FONTS, BODY_FONTS } = require('./spec');

const SPEC_SYSTEM = `Você é o Designer do NEXIA Site Kit. Você NÃO escreve código: devolve só um objeto JSON com o conteúdo e as escolhas visuais; o kit gera HTML/CSS/JS profissional a partir dele.
Regras:
- Responda APENAS com o JSON (sem explicação, sem markdown).
- Textos em português do Brasil, específicos do negócio, persuasivos e reais (nada de "lorem ipsum" ou "Serviço 1").
- fonts: escolha DESTAS listas. heading: ${HEADING_FONTS.join(', ')}. body: ${BODY_FONTS.join(', ')}.
- palette: cores hex de 6 dígitos com bom contraste (texto escuro sobre bg claro; "dark" é o fundo do rodapé/menu).
- style: elegant | modern | bold | soft.
- Mídia: fotos reais em todo lugar; "video" (seção) usa "youtube" (link que o usuário deu) ou video_query; "music" usa "audio_url" (link que o usuário deu) ou audio_query (ex.: "calm acoustic guitar"); gallery pode ter gif_queries (GIF animado); "links" é uma lista de botões (label, url, icon: whatsapp|instagram|facebook|youtube|tiktok|linkedin|spotify|mail|phone|pin|link|calendar|cart|play). Links, vídeos e músicas que o usuário citar no pedido entram SEMPRE.
- *_query: buscas de foto EM INGLÊS, curtas (2 a 4 palavras), concretas e visuais (ex.: "bakery bread counter"), uma por item; video_query só se um vídeo de fundo fizer sentido.
- photo_theme: 1 a 3 palavras em inglês que toda foto do site precisa ter a ver (ex.: "bakery bread", "dentist dental", "gym fitness").
- Se o pedido não traz contato, invente dados plausíveis e marcados como exemplo (ex.: "(11) 90000-0000").
- folder: a pasta pedida pelo usuário; se não houver, "sites/<nome-curto>".`;

function specPrompt({ message, kind, project }) {
  const site = kind !== 'system';
  return `Pedido do usuário: "${message}"
Projeto: ${project || '—'}
Tipo: ${site ? 'site (landing/institucional)' : 'sistema (painel com cadastros)'}

${site
    ? `Seções possíveis (type): hero, services, about, gallery, video, music, links, team, testimonials, faq, cta, contact. MÍNIMO OBRIGATÓRIO (padrão de qualidade NEXIA): hero, services (3 a 6 itens), about (com stats), gallery (6 a 8 buscas), testimonials (3), faq (4+), cta e contact; comece por hero e termine em contact. Acrescente video, music e links quando combinarem com o negócio ou o pedido citar.`
    : `entities: 1 a 4 cadastros do sistema; cada um com 3 a 8 fields (type: text, number, money, date, email, phone, select com options, textarea) e 4 a 6 linhas de sample realistas.`}

Formato (exemplo de ${site ? 'site' : 'sistema'}; troque tudo pelo conteúdo do pedido):
${JSON.stringify(site ? SITE_EXAMPLE : SYSTEM_EXAMPLE)}`;
}

module.exports = { SPEC_SYSTEM, specPrompt, SITE_EXAMPLE, SYSTEM_EXAMPLE };
