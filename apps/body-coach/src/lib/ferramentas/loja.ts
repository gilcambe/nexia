// Loja do Body Coach: catálogo com links de afiliado (Amazon Associados e Mercado Livre Afiliados).
// A NEXIA ganha comissão em cada compra, sem custo para o aluno. Preencha os códigos quando as contas forem aprovadas.
export const AFILIADOS = {
  amazon: '', // tag do Amazon Associados, ex.: "nexia-20"
  mercadolivre: '', // código do Mercado Livre Afiliados (vai no parâmetro "matt_tool")
};

export type CategoriaLoja = 'Suplementos' | 'Acessórios de treino' | 'Treino em casa' | 'Relógios e cintas' | 'Roupas e tênis' | 'Cozinha fit';
export interface ProdutoLoja { id: string; nome: string; categoria: CategoriaLoja; busca: string; porque: string; icone: string; tags: string[] }

export const PRODUTOS: ProdutoLoja[] = [
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
