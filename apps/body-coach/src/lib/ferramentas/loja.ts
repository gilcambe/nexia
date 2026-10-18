// Loja do Body Coach: catálogo com links de afiliado (Amazon Associados e Mercado Livre Afiliados).
// A NEXIA ganha comissão em cada compra, sem custo para o aluno. Preencha os códigos quando as contas forem aprovadas.
export const AFILIADOS = {
  amazon: 'gilcambe-20', // tag do Amazon Associados, ex.: "nexia-20"
  mercadolivre: '', // código do Mercado Livre Afiliados (vai no parâmetro "matt_tool")
};

export type CategoriaLoja = 'Suplementos' | 'Acessórios de treino' | 'Treino em casa' | 'Relógios e cintas' | 'Roupas e tênis' | 'Cozinha fit';
export interface ProdutoLoja { id: string; nome: string; categoria: CategoriaLoja; busca: string; porque: string; icone: string; tags: string[] }

const BASE: ProdutoLoja[] = [
  { id: 'whey', nome: 'Whey protein', categoria: 'Suplementos', busca: 'whey protein concentrado 900g', porque: 'Ajuda a bater a meta de proteína do dia.', icone: 'ri-cup-line', tags: ['hipertrofia', 'emagrecimento', 'forca', 'proteina'] },
  { id: 'creatina', nome: 'Creatina monohidratada', categoria: 'Suplementos', busca: 'creatina monohidratada 300g', porque: 'O suplemento mais estudado para força e massa.', icone: 'ri-capsule-line', tags: ['hipertrofia', 'forca'] },
  { id: 'vitd', nome: 'Vitamina D3', categoria: 'Suplementos', busca: 'vitamina d3 2000ui', porque: 'Indicada quando o exame mostra vitamina D baixa.', icone: 'ri-sun-line', tags: ['vitamina_d'] },
  { id: 'omega', nome: 'Ômega 3', categoria: 'Suplementos', busca: 'omega 3 epa dha', porque: 'Coração, articulações e triglicérides.', icone: 'ri-drop-line', tags: ['triglicerides', 'saude'] },
  { id: 'magnesio', nome: 'Magnésio', categoria: 'Suplementos', busca: 'magnesio dimalato', porque: 'Sono e recuperação muscular.', icone: 'ri-moon-line', tags: ['sono'] },
  { id: 'cafeina', nome: 'Cafeína / pré-treino', categoria: 'Suplementos', busca: 'cafeina 200mg capsulas', porque: 'Mais energia e foco no treino.', icone: 'ri-flashlight-line', tags: ['emagrecimento', 'resistencia'] },
  { id: 'eletrolito', nome: 'Isotônico / eletrólitos', categoria: 'Suplementos', busca: 'eletrolitos em po corrida', porque: 'Para treinos longos e calor.', icone: 'ri-drop-fill', tags: ['resistencia', 'corrida'] },
  { id: 'coqueteleira', nome: 'Coqueteleira', categoria: 'Acessórios de treino', busca: 'coqueteleira 700ml', porque: 'Para o whey e a água do treino.', icone: 'ri-cup-fill', tags: ['proteina'] },
  { id: 'luva', nome: 'Luva de musculação', categoria: 'Acessórios de treino', busca: 'luva musculação', porque: 'Pegada firme e menos calo.', icone: 'ri-hand-heart-line', tags: ['hipertrofia', 'forca'] },
  { id: 'strap', nome: 'Strap / munhequeira', categoria: 'Acessórios de treino', busca: 'strap musculação', porque: 'Segura cargas altas nas puxadas e no terra.', icone: 'ri-links-line', tags: ['forca'] },
  { id: 'cinto', nome: 'Cinto de levantamento', categoria: 'Acessórios de treino', busca: 'cinto lombar levantamento de peso', porque: 'Estabilidade no agachamento e no terra pesado.', icone: 'ri-shield-line', tags: ['forca'] },
  { id: 'garrafa', nome: 'Garrafa térmica 1 L', categoria: 'Acessórios de treino', busca: 'garrafa termica 1 litro academia', porque: 'Facilita bater a meta de água.', icone: 'ri-drop-line', tags: ['agua'] },
  { id: 'elastico', nome: 'Kit elásticos de resistência', categoria: 'Treino em casa', busca: 'kit elastico extensor 11 peças', porque: 'Treino completo em casa ou viagem.', icone: 'ri-git-commit-line', tags: ['casa', 'emagrecimento'] },
  { id: 'halter', nome: 'Halteres ajustáveis', categoria: 'Treino em casa', busca: 'halter ajustavel par', porque: 'Musculação em casa ocupando pouco espaço.', icone: 'ri-boxing-line', tags: ['casa', 'hipertrofia'] },
  { id: 'corda', nome: 'Corda de pular', categoria: 'Treino em casa', busca: 'corda de pular rolamento', porque: 'Cardio intenso em 10 minutos.', icone: 'ri-loop-left-line', tags: ['emagrecimento', 'hiit'] },
  { id: 'tapete', nome: 'Tapete de yoga', categoria: 'Treino em casa', busca: 'tapete yoga 6mm', porque: 'Para abdômen, alongamento e yoga.', icone: 'ri-layout-row-line', tags: ['yoga', 'casa'] },
  { id: 'rolo', nome: 'Rolo de liberação miofascial', categoria: 'Treino em casa', busca: 'rolo liberação miofascial', porque: 'Recuperação e menos dor muscular.', icone: 'ri-refresh-line', tags: ['recuperacao'] },
  { id: 'cinta', nome: 'Cinta cardíaca Bluetooth', categoria: 'Relógios e cintas', busca: 'cinta cardiaca bluetooth', porque: 'Conecta no app e mostra batimentos e calorias reais.', icone: 'ri-heart-pulse-line', tags: ['corrida', 'resistencia', 'emagrecimento'] },
  { id: 'relogio', nome: 'Relógio com GPS', categoria: 'Relógios e cintas', busca: 'relogio gps corrida frequencia cardiaca', porque: 'Corridas com GPS e batimentos no pulso.', icone: 'ri-timer-line', tags: ['corrida', 'resistencia'] },
  { id: 'balanca', nome: 'Balança de bioimpedância', categoria: 'Relógios e cintas', busca: 'balança bioimpedancia bluetooth', porque: 'Peso, gordura e músculo em casa.', icone: 'ri-scales-3-line', tags: ['emagrecimento', 'evolucao'] },
  { id: 'fita', nome: 'Fita métrica corporal', categoria: 'Relógios e cintas', busca: 'fita metrica corporal trava', porque: 'Medidas certinhas para a Evolução.', icone: 'ri-ruler-line', tags: ['evolucao'] },
  { id: 'tenis', nome: 'Tênis de corrida', categoria: 'Roupas e tênis', busca: 'tenis corrida amortecimento', porque: 'Amortecimento certo evita lesão.', icone: 'ri-footprint-line', tags: ['corrida'] },
  { id: 'tenis-treino', nome: 'Tênis para musculação', categoria: 'Roupas e tênis', busca: 'tenis treino academia solado reto', porque: 'Solado firme dá estabilidade no agachamento.', icone: 'ri-footprint-fill', tags: ['hipertrofia', 'forca'] },
  { id: 'dryfit', nome: 'Camiseta dry fit', categoria: 'Roupas e tênis', busca: 'camiseta dry fit masculina feminina', porque: 'Seca rápido, treino mais confortável.', icone: 'ri-t-shirt-line', tags: [] },
  { id: 'balanca-cozinha', nome: 'Balança de cozinha', categoria: 'Cozinha fit', busca: 'balança de cozinha digital', porque: 'Pesar a comida deixa a dieta precisa.', icone: 'ri-scales-line', tags: ['emagrecimento', 'dieta'] },
  { id: 'marmita', nome: 'Kit marmitas de vidro', categoria: 'Cozinha fit', busca: 'kit marmita vidro tampa', porque: 'Dieta da semana pronta na geladeira.', icone: 'ri-inbox-line', tags: ['dieta'] },
  { id: 'airfryer', nome: 'Air fryer', categoria: 'Cozinha fit', busca: 'air fryer 4 litros', porque: 'Comida crocante quase sem óleo.', icone: 'ri-fire-line', tags: ['emagrecimento', 'dieta'] },
];

// Mais itens (cada link de compra leva o código de afiliado da NEXIA; ver linkAmazon e linkMercadoLivre).
const p = (id: string, nome: string, categoria: CategoriaLoja, busca: string, porque: string, icone: string, tags: string[] = []): ProdutoLoja => ({ id, nome, categoria, busca, porque, icone, tags });
const EXTRA: ProdutoLoja[] = [
  p('whey-iso', 'Whey isolado', 'Suplementos', 'whey protein isolado 900g', 'Mais proteína e menos lactose por dose.', 'ri-cup-line', ['hipertrofia', 'proteina', 'emagrecimento']),
  p('albumina', 'Albumina', 'Suplementos', 'albumina em po 500g', 'Proteína barata para fechar a meta do dia.', 'ri-cup-line', ['proteina']),
  p('hipercalorico', 'Hipercalórico', 'Suplementos', 'hipercalorico massa 3kg', 'Para quem tem dificuldade de ganhar peso.', 'ri-cup-line', ['hipertrofia']),
  p('bcaa', 'BCAA / aminoácidos', 'Suplementos', 'bcaa 2:1:1 120 capsulas', 'Apoio na recuperação em treino em jejum.', 'ri-capsule-line', ['recuperacao']),
  p('glutamina', 'Glutamina', 'Suplementos', 'glutamina 300g', 'Recuperação em fases de treino pesado.', 'ri-capsule-line', ['recuperacao']),
  p('pre-treino', 'Pré-treino', 'Suplementos', 'pre treino 300g', 'Energia e foco antes do treino.', 'ri-flashlight-line', ['resistencia', 'hipertrofia']),
  p('termogenico', 'Termogênico', 'Suplementos', 'termogenico cafeina capsulas', 'Apoio na fase de emagrecimento (com dieta).', 'ri-fire-line', ['emagrecimento']),
  p('colageno', 'Colágeno hidrolisado', 'Suplementos', 'colageno hidrolisado po', 'Articulações e pele.', 'ri-capsule-line', ['saude']),
  p('multivit', 'Multivitamínico', 'Suplementos', 'multivitaminico a-z', 'Garante o básico quando a dieta falha.', 'ri-capsule-line', ['saude']),
  p('zinco', 'Zinco e magnésio (ZMA)', 'Suplementos', 'zma zinco magnesio b6', 'Sono e recuperação.', 'ri-moon-line', ['sono']),
  p('melatonina', 'Melatonina', 'Suplementos', 'melatonina 5mg', 'Ajuda a dormir melhor.', 'ri-moon-line', ['sono']),
  p('beta-alanina', 'Beta-alanina', 'Suplementos', 'beta alanina 120g', 'Mais resistência em séries longas.', 'ri-capsule-line', ['resistencia']),
  p('pasta-amendoim', 'Pasta de amendoim', 'Suplementos', 'pasta de amendoim integral 1kg', 'Calorias boas e proteína no café da manhã.', 'ri-restaurant-line', ['hipertrofia', 'dieta']),
  p('barra-proteina', 'Barra de proteína', 'Suplementos', 'barra de proteina caixa', 'Lanche prático com proteína.', 'ri-restaurant-line', ['proteina']),
  p('gel-carbo', 'Gel de carboidrato', 'Suplementos', 'gel de carboidrato corrida', 'Energia em corridas e treinos longos.', 'ri-drop-fill', ['corrida', 'resistencia']),
  p('maltodextrina', 'Maltodextrina / dextrose', 'Suplementos', 'maltodextrina 1kg', 'Carboidrato rápido pós-treino.', 'ri-capsule-line', ['hipertrofia']),
  p('chuteira-lev', 'Munhequeira de punho', 'Acessórios de treino', 'munhequeira punho musculacao', 'Protege o punho no supino e no desenvolvimento.', 'ri-links-line', ['forca']),
  p('joelheira', 'Joelheira de compressão', 'Acessórios de treino', 'joelheira compressao academia', 'Conforto no agachamento e na corrida.', 'ri-shield-line', ['forca', 'corrida']),
  p('bolsa', 'Bolsa de treino', 'Acessórios de treino', 'bolsa academia mochila esportiva', 'Leva roupa, tênis e shaker.', 'ri-briefcase-line', []),
  p('toalha', 'Toalha de microfibra', 'Acessórios de treino', 'toalha microfibra esportiva', 'Seca rápido e ocupa pouco espaço.', 'ri-layout-row-line', []),
  p('fone-esporte', 'Fone Bluetooth esportivo', 'Acessórios de treino', 'fone bluetooth esportivo a prova dagua', 'Treino com música e o coach por voz.', 'ri-headphone-line', []),
  p('bracadeira', 'Braçadeira para celular', 'Acessórios de treino', 'bracadeira celular corrida', 'Leva o celular na corrida.', 'ri-smartphone-line', ['corrida']),
  p('magnesio-giz', 'Magnésio em pó (giz)', 'Acessórios de treino', 'magnesia em po escalada levantamento', 'Pegada firme sem escorregar.', 'ri-hand-heart-line', ['forca']),
  p('wrist-roller', 'Roller de antebraço', 'Acessórios de treino', 'wrist roller antebraco', 'Antebraço mais forte.', 'ri-links-line', ['forca']),
  p('abdominal-roda', 'Roda abdominal', 'Treino em casa', 'roda abdominal com joelheira', 'Abdômen forte sem aparelho grande.', 'ri-loop-left-line', ['casa', 'emagrecimento']),
  p('barra-porta', 'Barra de porta (pull-up)', 'Treino em casa', 'barra fixa porta multifuncional', 'Barra fixa em casa.', 'ri-boxing-line', ['casa', 'hipertrofia']),
  p('kettlebell', 'Kettlebell', 'Treino em casa', 'kettlebell 8kg 12kg', 'Treino de força e cardio num só item.', 'ri-boxing-line', ['casa', 'hiit']),
  p('anilha', 'Par de halteres emborrachados', 'Treino em casa', 'halteres emborrachados par', 'Base da musculação em casa.', 'ri-boxing-line', ['casa', 'hipertrofia']),
  p('step', 'Step de academia', 'Treino em casa', 'step aerobico academia', 'Cardio e glúteo em casa.', 'ri-layout-row-line', ['casa', 'emagrecimento']),
  p('bola-suica', 'Bola suíça', 'Treino em casa', 'bola suica 65cm', 'Core, postura e alongamento.', 'ri-record-circle-line', ['casa', 'yoga']),
  p('mini-band', 'Mini band (elástico de perna)', 'Treino em casa', 'mini band elastico gluteo', 'Ativa o glúteo antes do treino.', 'ri-git-commit-line', ['casa']),
  p('cinto-supino', 'Anilhas e barra', 'Treino em casa', 'kit barra anilha 20kg', 'Home gym de verdade.', 'ri-boxing-line', ['casa', 'hipertrofia']),
  p('pistola-massagem', 'Pistola de massagem', 'Treino em casa', 'pistola massagem muscular', 'Alivia dor e acelera a recuperação.', 'ri-refresh-line', ['recuperacao']),
  p('smartband', 'Smartband / pulseira fitness', 'Relógios e cintas', 'smartband pulseira fitness frequencia cardiaca', 'Passos, sono e batimentos baratos.', 'ri-timer-line', ['saude']),
  p('smartwatch', 'Smartwatch', 'Relógios e cintas', 'smartwatch esportivo gps', 'Treino e saúde no pulso.', 'ri-timer-line', ['corrida']),
  p('oximetro', 'Oxímetro de dedo', 'Relógios e cintas', 'oximetro de dedo', 'Acompanha oxigenação e pulso.', 'ri-heart-pulse-line', ['saude']),
  p('pressao', 'Medidor de pressão', 'Relógios e cintas', 'medidor de pressao arterial digital braço', 'Combina com o registro de pressão do app.', 'ri-heart-add-line', ['saude']),
  p('glicosimetro', 'Medidor de glicemia', 'Relógios e cintas', 'medidor de glicose kit', 'Combina com o registro de glicemia do app.', 'ri-heart-add-line', ['saude']),
  p('adipometro', 'Adipômetro (plicômetro)', 'Relógios e cintas', 'adipometro plicometro', 'Mede gordura corporal em casa.', 'ri-ruler-line', ['evolucao']),
  p('legging', 'Legging de treino', 'Roupas e tênis', 'legging academia cintura alta', 'Conforto e compressão.', 'ri-t-shirt-line', []),
  p('top', 'Top esportivo', 'Roupas e tênis', 'top esportivo sustentacao', 'Sustentação para treino.', 'ri-t-shirt-line', []),
  p('shorts', 'Shorts de treino', 'Roupas e tênis', 'shorts treino masculino feminino', 'Liberdade nos movimentos.', 'ri-t-shirt-line', []),
  p('regata', 'Regata de musculação', 'Roupas e tênis', 'regata musculacao masculina', 'Ventilação para treinos pesados.', 'ri-t-shirt-line', []),
  p('meia', 'Meias esportivas (kit)', 'Roupas e tênis', 'meia esportiva cano medio kit', 'Menos bolhas e mais conforto.', 'ri-footprint-line', []),
  p('jaqueta', 'Jaqueta corta-vento', 'Roupas e tênis', 'jaqueta corta vento corrida', 'Corrida no frio ou na chuva.', 'ri-t-shirt-line', ['corrida']),
  p('squeeze', 'Squeeze 2 L', 'Cozinha fit', 'garrafa squeeze 2 litros', 'Meta de água do dia na mão.', 'ri-drop-line', ['agua']),
  p('processador', 'Mini processador / liquidificador', 'Cozinha fit', 'liquidificador portatil shake', 'Shakes e vitaminas rápidas.', 'ri-fire-line', ['dieta']),
  p('grill', 'Grill elétrico', 'Cozinha fit', 'grill eletrico antiaderente', 'Frango e carne sem gordura extra.', 'ri-fire-line', ['dieta', 'emagrecimento']),
  p('pote-hermetico', 'Potes herméticos (kit)', 'Cozinha fit', 'potes hermeticos kit marmita', 'Organiza as refeições da semana.', 'ri-inbox-line', ['dieta']),
  p('bolsa-termica', 'Bolsa térmica para marmitas', 'Cozinha fit', 'bolsa termica marmita fitness', 'Leva a dieta para o trabalho.', 'ri-briefcase-line', ['dieta']),
  p('adocante', 'Adoçante natural (stévia)', 'Cozinha fit', 'adocante stevia po', 'Corta açúcar sem perder o sabor.', 'ri-restaurant-line', ['emagrecimento']),
  p('temperos', 'Kit de temperos naturais', 'Cozinha fit', 'kit temperos naturais sem sodio', 'Sabor na dieta sem exagerar no sal.', 'ri-restaurant-line', ['dieta']),
  p('aveia', 'Aveia e farelo', 'Cozinha fit', 'aveia em flocos 1kg', 'Fibra e energia no café da manhã.', 'ri-restaurant-line', ['dieta']),
  p('livro', 'Livro de treino e nutrição', 'Acessórios de treino', 'livro musculacao nutricao esportiva', 'Aprenda mais sobre o seu treino.', 'ri-book-open-line', []),
  p('foam', 'Faixa de liberação (lacrosse ball)', 'Treino em casa', 'bola de lacrosse liberacao miofascial', 'Libera pontos de tensão.', 'ri-refresh-line', ['recuperacao']),
  p('cadeira-massagem', 'Almofada de massagem', 'Treino em casa', 'almofada massageadora', 'Relaxa depois do treino pesado.', 'ri-refresh-line', ['recuperacao']),
];

export const PRODUTOS: ProdutoLoja[] = [...BASE, ...EXTRA];

export function linkAmazon(busca: string): string {
  const p = new URLSearchParams({ k: busca });
  if (AFILIADOS.amazon) p.set('tag', AFILIADOS.amazon);
  return `https://www.amazon.com.br/s?${p.toString()}`;
}
export function linkMercadoLivre(busca: string): string {
  const base = `https://lista.mercadolivre.com.br/${encodeURIComponent(busca.replace(/\s+/g, '-'))}`;
  return AFILIADOS.mercadolivre ? `${base}?matt_tool=${encodeURIComponent(AFILIADOS.mercadolivre)}` : base;
}

// Recomenda pelo objetivo, pelas modalidades, pelos suplementos que o aluno já usa e pelos exames.
export function recomendados(o: { objetivo?: string; modalidades?: string[]; marcadoresBaixos?: string[]; suplementos?: string[] }): ProdutoLoja[] {
  const tags = new Set<string>(['proteina', 'agua']);
  const g = (o.objetivo ?? '').toLowerCase();
  if (/hipertrof|massa|ganh/.test(g)) tags.add('hipertrofia');
  if (/emagre|perd|gordura|defini/.test(g)) tags.add('emagrecimento');
  if (/for[cç]a/.test(g)) tags.add('forca');
  if (/resist|condicion/.test(g)) tags.add('resistencia');
  for (const m of o.modalidades ?? []) if (/corr/i.test(m)) tags.add('corrida');
  for (const m of o.marcadoresBaixos ?? []) tags.add(m);
  const jaTem = (o.suplementos ?? []).map((s) => s.toLowerCase());
  return PRODUTOS
    .filter((p) => p.tags.some((t) => tags.has(t)) && !jaTem.some((s) => p.nome.toLowerCase().includes(s.split(' ')[0])))
    .sort((a, b) => b.tags.filter((t) => tags.has(t)).length - a.tags.filter((t) => tags.has(t)).length)
    .slice(0, 6);
}
