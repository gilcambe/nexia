'use strict';

/**
 * Converte briefing, design.json ou molde em um clientes/<slug>/site.json normalizado.
 * Uso CLI: node scripts/briefing-para-spec.js [slug-ou-caminho] [--force]
 */

const fs = require('fs');
const path = require('path');
const kit = require('../nexia-ai/site-kit');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLIENTS_DIR = path.join(ROOT_DIR, 'clientes');
const MOLDES_DIR = path.join(CLIENTS_DIR, '_moldes');

/** Remove marcadores [TROCAR] e limpa espaços */
function cleanPlaceholder(text, fallback = '') {
  if (typeof text !== 'string') return fallback;
  const cleaned = text.replace(/\[TROCAR\]/gi, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Formata número de WhatsApp (apenas dígitos) */
function sanitizeWhatsapp(raw) {
  if (!raw) return '5511999998888';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '5511999998888';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Mapeia nome do nicho para arquivo de molde disponível */
function getMoldePath(nicho) {
  if (!nicho || typeof nicho !== 'string') return null;
  const slug = nicho.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const map = {
    advogado: 'advogado.json',
    advocacia: 'advogado.json',
    juridico: 'advogado.json',
    clinica: 'clinica.json',
    saude: 'clinica.json',
    medica: 'clinica.json',
    dentista: 'dentista.json',
    odontologia: 'dentista.json',
    estetica: 'salao-estetica.json',
    beleza: 'salao-estetica.json',
    salao: 'salao-estetica.json',
    imobiliaria: 'imobiliaria.json',
    corretor: 'imobiliaria.json',
    restaurante: 'restaurante.json',
    comida: 'restaurante.json',
    gastronomia: 'restaurante.json',
    academia: 'academia-personal.json',
    personal: 'academia-personal.json',
    treino: 'academia-personal.json',
    contabilidade: 'contabilidade.json',
    contabil: 'contabilidade.json',
    eventos: 'eventos.json',
    festas: 'eventos.json',
    loja: 'loja.json',
    comercio: 'loja.json',
  };
  const fileName = map[slug] || `${slug}.json`;
  const fullPath = path.join(MOLDES_DIR, fileName);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/** Lê e interpreta briefing.json, briefing.txt ou design.json na pasta do cliente */
function readClientBriefingOrDesign(clientDir) {
  const briefingJsonPath = path.join(clientDir, 'briefing.json');
  if (fs.existsSync(briefingJsonPath)) {
    try {
      return { type: 'briefing', data: JSON.parse(fs.readFileSync(briefingJsonPath, 'utf8')) };
    } catch { /* ignora erro de parse */ }
  }

  const designJsonPath = path.join(clientDir, 'design.json');
  const refDesignPath = path.join(clientDir, 'referencia', 'design.json');
  const dPath = fs.existsSync(designJsonPath) ? designJsonPath : fs.existsSync(refDesignPath) ? refDesignPath : null;
  if (dPath) {
    try {
      return { type: 'design', data: JSON.parse(fs.readFileSync(dPath, 'utf8')) };
    } catch { /* ignora erro de parse */ }
  }

  const briefingTxtPath = path.join(clientDir, 'briefing.txt');
  if (fs.existsSync(briefingTxtPath)) {
    const text = fs.readFileSync(briefingTxtPath, 'utf8');
    return { type: 'txt', data: { texto: text } };
  }

  return null;
}

/** Constrói o spec completo de site a partir dos dados do briefing/design/molde */
function buildSpec(slug, rawInput = {}) {
  const briefing = rawInput.type === 'briefing' ? rawInput.data : {};
  const design = rawInput.type === 'design' ? rawInput.data : {};
  const txt = rawInput.type === 'txt' ? rawInput.data : {};

  const nameRaw = briefing.nomeEAtividade || briefing.nome || briefing.name || briefing.empresa || design.nome || slug;
  const name = cleanPlaceholder(nameRaw, slug.charAt(0).toUpperCase() + slug.slice(1));

  const nicho = (briefing.nicho || design.nicho || 'geral').toLowerCase();
  let moldeData = {};
  const moldeFile = getMoldePath(nicho);
  if (moldeFile) {
    try {
      moldeData = JSON.parse(fs.readFileSync(moldeFile, 'utf8'));
    } catch { /* ignora */ }
  }

  const tagline = cleanPlaceholder(
    briefing.tagline || briefing.motivosDiferenciais || moldeData.tagline,
    `Excelência e qualidade em ${name}`
  );
  const description = cleanPlaceholder(
    briefing.description || briefing.servicosProdutos || txt.texto || moldeData.description,
    `Soluções completas e atendimento personalizado em ${name}.`
  );

  const contact = {
    whatsapp: sanitizeWhatsapp(briefing.whatsapp || briefing.telefone || (moldeData.contato && moldeData.contato.whatsapp)),
    phone: cleanPlaceholder(briefing.telefone || (moldeData.contato && moldeData.contato.telefone), '(11) 99999-8888'),
    email: cleanPlaceholder(briefing.email || (moldeData.contato && moldeData.contato.email), `contato@${slug}.com.br`),
    address: cleanPlaceholder(briefing.cidadeEndereco || briefing.endereco || (moldeData.contato && moldeData.contato.endereco), 'Atendimento em toda a região'),
    city: cleanPlaceholder(briefing.cidade || 'São Paulo - SP'),
    hours: cleanPlaceholder(briefing.horarioFuncionamento || briefing.horario || 'Segunda a Sexta, das 08h às 18h'),
    instagram: cleanPlaceholder(briefing.instagram, '').replace(/^@/, ''),
    facebook: cleanPlaceholder(briefing.facebook, ''),
    youtube: cleanPlaceholder(briefing.youtube, ''),
    tiktok: cleanPlaceholder(briefing.tiktok, '').replace(/^@/, ''),
    linkedin: cleanPlaceholder(briefing.linkedin, ''),
  };

  const style = design.style || moldeData.style || 'modern';
  const photoTheme = briefing.photo_theme || moldeData.photo_theme || `${nicho} business`;

  const rawServices = briefing.servicosProdutos ? briefing.servicosProdutos.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) : [];
  const serviceItems = rawServices.length >= 3
    ? rawServices.slice(0, 6).map((s, idx) => ({
        title: cleanPlaceholder(s, `Serviço ${idx + 1}`),
        text: `Atendimento especializado e personalizado para ${cleanPlaceholder(s).toLowerCase()}.`,
        image_query: `${nicho} ${cleanPlaceholder(s)}`,
      }))
    : [
        { title: 'Atendimento Personalizado', text: 'Análise detalhada das suas necessidades com suporte dedicado.', image_query: `${nicho} consultation` },
        { title: 'Serviços Especializados', text: 'Soluções modernas executadas por profissionais experientes.', image_query: `${nicho} professional` },
        { title: 'Garantia de Qualidade', text: 'Compromisso com resultados eficientes e satisfação do cliente.', image_query: `${nicho} quality` },
      ];

  const sections = [
    {
      type: 'hero',
      eyebrow: cleanPlaceholder(name),
      title: cleanPlaceholder(briefing.heroTitle, `Bem-vindo à ${name}`),
      subtitle: tagline,
      cta: { label: 'Falar no WhatsApp', href: 'whatsapp' },
      cta2: { label: 'Conhecer Serviços', href: '#servicos' },
      image_query: `${photoTheme} hero`,
    },
    {
      type: 'services',
      id: 'servicos',
      title: 'Nossos Serviços',
      subtitle: 'Conheça nossas principais soluções',
      items: serviceItems,
    },
    {
      type: 'about',
      title: `Sobre a ${name}`,
      text: description,
      image_query: `${photoTheme} office`,
      stats: [
        { value: '100%', label: 'Dedicação' },
        { value: '5★', label: 'Avaliação' },
        { value: '1000+', label: 'Clientes Atendidos' },
      ],
    },
    {
      type: 'gallery',
      title: 'Nosso Trabalho',
      image_queries: [
        `${photoTheme} work 1`,
        `${photoTheme} work 2`,
        `${photoTheme} work 3`,
        `${photoTheme} team`,
      ],
    },
    {
      type: 'testimonials',
      title: 'Depoimentos',
      items: [
        { name: 'Maria Silva', text: 'Excelente atendimento e profissionais capacitados. Recomendo!', rating: 5 },
        { name: 'João Santos', text: 'Serviço rápido, transparente e de altíssima qualidade.', rating: 5 },
        { name: 'Ana Oliveira', text: 'Superou todas as minhas expectativas. Muito satisfeito!', rating: 5 },
      ],
    },
    {
      type: 'faq',
      title: 'Perguntas Frequentes',
      items: [
        { q: 'Como solicito um orçamento?', a: 'Você pode entrar em contato conosco diretamente pelo WhatsApp ou formulário de contato.' },
        { q: 'Quais são as formas de pagamento?', a: 'Aceitamos PIX, cartões de crédito e débito, e boleto bancário.' },
        { q: 'Qual o horário de atendimento?', a: contact.hours },
        { q: 'Onde vocês estão localizados?', a: contact.address },
      ],
    },
    {
      type: 'cta',
      title: 'Pronto para começar?',
      subtitle: 'Fale com a nossa equipe agora mesmo e tire suas dúvidas.',
      cta: { label: 'Entrar em Contato', href: 'whatsapp' },
    },
    {
      type: 'contact',
      title: 'Fale Conosco',
    },
  ];

  const rawSpec = {
    kind: 'site',
    name,
    tagline,
    description,
    folder: `sites/${slug}`,
    style,
    photo_theme: photoTheme,
    fonts: { heading: 'Plus Jakarta Sans', body: 'Inter' },
    palette: {
      primary: (moldeData.estilo && moldeData.estilo.primario) || '#1f6f5c',
      accent: (moldeData.estilo && moldeData.estilo.secundario) || '#f2a541',
      bg: '#fbfaf7',
      surface: '#ffffff',
      text: '#1d2426',
      muted: '#5d6b6e',
      dark: '#12201d',
    },
    contact,
    sections,
  };

  const { spec, errors } = kit.normalizeSpec(rawSpec, { kind: 'site' });
  if (!spec) {
    throw new Error(`Erro ao normalizar spec para ${slug}: ${errors.join('; ')}`);
  }
  return spec;
}

/** Processa uma pasta de cliente específica */
function converterBriefingParaSpec(slugOrPath, options = {}) {
  const force = !!options.force;
  const cleanSlug = path.basename(slugOrPath.replace(/[/\\]+$/, ''));
  const clientDir = path.isAbsolute(slugOrPath)
    ? slugOrPath
    : slugOrPath.startsWith('clientes')
      ? path.resolve(ROOT_DIR, slugOrPath)
      : path.join(CLIENTS_DIR, cleanSlug);

  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }

  const siteJsonPath = path.join(clientDir, 'site.json');
  if (fs.existsSync(siteJsonPath) && !force) {
    const existing = JSON.parse(fs.readFileSync(siteJsonPath, 'utf8'));
    const { spec } = kit.normalizeSpec(existing, { kind: 'site' });
    return { slug: cleanSlug, filePath: siteJsonPath, status: 'existing', spec: spec || existing };
  }

  const rawInput = readClientBriefingOrDesign(clientDir) || {};
  const spec = buildSpec(cleanSlug, rawInput);
  fs.writeFileSync(siteJsonPath, JSON.stringify(spec, null, 2) + '\n', 'utf8');

  return { slug: cleanSlug, filePath: siteJsonPath, status: 'created', spec };
}

/** Processa todas as pastas em clientes/ que não possuem site.json */
function processarTodosClientes(options = {}) {
  if (!fs.existsSync(CLIENTS_DIR)) return [];
  const entries = fs.readdirSync(CLIENTS_DIR, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    try {
      const res = converterBriefingParaSpec(entry.name, options);
      results.push(res);
    } catch (err) {
      console.error(`[briefing-para-spec] Erro ao processar ${entry.name}: ${err.message}`);
    }
  }

  return results;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const targetArg = args.find(a => !a.startsWith('--'));

  if (targetArg) {
    try {
      const res = converterBriefingParaSpec(targetArg, { force });
      console.log(`[briefing-para-spec] ${res.slug}: ${res.status} -> ${res.filePath}`);
    } catch (err) {
      console.error(`[briefing-para-spec] Falha: ${err.message}`);
      process.exit(1);
    }
  } else {
    const results = processarTodosClientes({ force });
    const created = results.filter(r => r.status === 'created').length;
    const existing = results.filter(r => r.status === 'existing').length;
    console.log(`[briefing-para-spec] Concluído. Criados: ${created}, Existentes: ${existing}`);
  }
}

module.exports = { converterBriefingParaSpec, processarTodosClientes, buildSpec, cleanPlaceholder, sanitizeWhatsapp };
