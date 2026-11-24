// Receitas fit prontas (sem gastar IA): fáceis, com ingredientes de mercado comum e macros por porção.
// Valores aproximados pela tabela TACO; servem de guia, não de prescrição.

export type TipoReceita = 'Café da manhã' | 'Almoço e jantar' | 'Lanche' | 'Doce' | 'Pós-treino';
export interface Receita {
  id: string; nome: string; tipo: TipoReceita; min: number; kcal: number; p: number; c: number; g: number;
  ingredientes: string[]; preparo: string[]; tags: ('proteina' | 'low-carb' | 'sem-lactose' | 'vegetariana' | 'barata')[];
}

export const RECEITAS: Receita[] = [
  { id: 'panqueca-banana', nome: 'Panqueca de banana e aveia', tipo: 'Café da manhã', min: 10, kcal: 330, p: 17, c: 42, g: 10, tags: ['vegetariana', 'barata', 'sem-lactose'],
    ingredientes: ['1 banana madura', '2 ovos', '3 colheres (sopa) de aveia', 'Canela a gosto'], preparo: ['Amasse a banana e misture com os ovos e a aveia.', 'Frigideira antiaderente em fogo baixo, 2 min de cada lado.', 'Finalize com canela.'] },
  { id: 'crepioca', nome: 'Crepioca de frango', tipo: 'Café da manhã', min: 10, kcal: 310, p: 30, c: 20, g: 11, tags: ['proteina', 'sem-lactose'],
    ingredientes: ['1 ovo', '2 colheres (sopa) de tapioca', '60 g de frango desfiado', 'Sal e orégano'], preparo: ['Bata o ovo com a tapioca e uma pitada de sal.', 'Despeje na frigideira, recheie com o frango e dobre.'] },
  { id: 'overnight', nome: 'Overnight oats com whey', tipo: 'Café da manhã', min: 5, kcal: 380, p: 32, c: 45, g: 8, tags: ['proteina'],
    ingredientes: ['40 g de aveia', '1 scoop de whey', '150 ml de leite desnatado', '1 colher (chá) de chia', 'Frutas vermelhas'], preparo: ['Misture tudo num pote com tampa.', 'Deixe na geladeira de um dia para o outro.'] },
  { id: 'omelete', nome: 'Omelete de forno com legumes', tipo: 'Café da manhã', min: 20, kcal: 260, p: 21, c: 6, g: 17, tags: ['low-carb', 'vegetariana', 'sem-lactose', 'barata'],
    ingredientes: ['3 ovos', '1/2 tomate', '1/4 de cebola', 'Espinafre ou couve', 'Sal e pimenta'], preparo: ['Bata os ovos e junte os legumes picados.', 'Forma untada, forno 200 °C por 15 min.'] },
  { id: 'frango-batata', nome: 'Frango com batata-doce na airfryer', tipo: 'Almoço e jantar', min: 25, kcal: 450, p: 42, c: 45, g: 10, tags: ['proteina', 'sem-lactose', 'barata'],
    ingredientes: ['150 g de peito de frango', '150 g de batata-doce em cubos', '1 colher (chá) de azeite', 'Páprica, alho e sal'], preparo: ['Tempere o frango e a batata.', 'Airfryer a 200 °C por 20 min, mexendo na metade.'] },
  { id: 'carne-panela', nome: 'Patinho moído com abobrinha', tipo: 'Almoço e jantar', min: 20, kcal: 340, p: 36, c: 9, g: 17, tags: ['low-carb', 'proteina', 'sem-lactose'],
    ingredientes: ['150 g de patinho moído', '1 abobrinha em cubos', 'Tomate, cebola e alho', 'Cheiro-verde'], preparo: ['Refogue cebola e alho, junte a carne até dourar.', 'Acrescente a abobrinha e o tomate, 8 min tampado.'] },
  { id: 'peixe-arroz', nome: 'Tilápia assada com arroz e salada', tipo: 'Almoço e jantar', min: 25, kcal: 420, p: 38, c: 42, g: 10, tags: ['proteina', 'sem-lactose'],
    ingredientes: ['150 g de tilápia', '4 colheres (sopa) de arroz cozido', 'Limão, alho e sal', 'Salada à vontade'], preparo: ['Tempere o peixe com limão, alho e sal.', 'Forno 200 °C por 18 min (ou airfryer 12 min).'] },
  { id: 'escondidinho', nome: 'Escondidinho de frango com mandioca', tipo: 'Almoço e jantar', min: 35, kcal: 470, p: 38, c: 50, g: 12, tags: ['proteina', 'barata'],
    ingredientes: ['200 g de mandioca cozida', '120 g de frango desfiado', '2 colheres (sopa) de requeijão light', 'Molho de tomate'], preparo: ['Amasse a mandioca com o requeijão.', 'Frango com molho embaixo, purê por cima, forno 15 min.'] },
  { id: 'grao-bico', nome: 'Salada de grão-de-bico e atum', tipo: 'Almoço e jantar', min: 10, kcal: 400, p: 33, c: 36, g: 13, tags: ['proteina', 'sem-lactose', 'barata'],
    ingredientes: ['1 lata de atum em água', '1 xícara de grão-de-bico cozido', 'Tomate, pepino e cebola roxa', 'Limão e azeite'], preparo: ['Misture tudo e tempere com limão, sal e 1 colher (chá) de azeite.'] },
  { id: 'lentilha', nome: 'Lentilha com legumes (vegana)', tipo: 'Almoço e jantar', min: 30, kcal: 380, p: 21, c: 58, g: 6, tags: ['vegetariana', 'sem-lactose', 'barata'],
    ingredientes: ['1 xícara de lentilha', 'Cenoura, abobrinha e cebola', 'Cominho e páprica'], preparo: ['Refogue a cebola, junte lentilha, legumes e água.', 'Cozinhe 25 min até a lentilha ficar macia.'] },
  { id: 'iogurte-proteico', nome: 'Iogurte proteico com granola', tipo: 'Lanche', min: 2, kcal: 260, p: 24, c: 28, g: 5, tags: ['proteina', 'vegetariana'],
    ingredientes: ['170 g de iogurte grego zero', '1/2 scoop de whey', '2 colheres (sopa) de granola sem açúcar'], preparo: ['Misture o whey no iogurte e cubra com a granola.'] },
  { id: 'sanduiche', nome: 'Sanduíche natural de frango', tipo: 'Lanche', min: 5, kcal: 320, p: 28, c: 32, g: 8, tags: ['proteina', 'barata'],
    ingredientes: ['2 fatias de pão integral', '70 g de frango desfiado', '1 colher (sopa) de requeijão light', 'Cenoura ralada e alface'], preparo: ['Misture o frango com o requeijão e a cenoura e monte o sanduíche.'] },
  { id: 'chips-grao', nome: 'Grão-de-bico crocante', tipo: 'Lanche', min: 25, kcal: 180, p: 9, c: 27, g: 4, tags: ['vegetariana', 'sem-lactose', 'barata'],
    ingredientes: ['1 xícara de grão-de-bico cozido e seco', 'Páprica, sal e alho em pó'], preparo: ['Tempere e leve à airfryer a 200 °C por 15-20 min, chacoalhando.'] },
  { id: 'shake', nome: 'Shake pós-treino de banana', tipo: 'Pós-treino', min: 3, kcal: 350, p: 30, c: 48, g: 5, tags: ['proteina'],
    ingredientes: ['1 scoop de whey', '1 banana', '200 ml de leite desnatado', '1 colher (sopa) de aveia'], preparo: ['Bata tudo no liquidificador com gelo.'] },
  { id: 'mousse', nome: 'Mousse de chocolate proteico', tipo: 'Doce', min: 5, kcal: 210, p: 26, c: 14, g: 5, tags: ['proteina', 'low-carb'],
    ingredientes: ['170 g de iogurte grego zero', '1/2 scoop de whey de chocolate', '1 colher (sopa) de cacau em pó'], preparo: ['Misture até ficar cremoso e leve à geladeira por 30 min.'] },
  { id: 'brigadeiro', nome: 'Brigadeiro de banana (sem açúcar)', tipo: 'Doce', min: 10, kcal: 150, p: 4, c: 28, g: 3, tags: ['vegetariana', 'sem-lactose', 'barata'],
    ingredientes: ['1 banana madura', '1 colher (sopa) de cacau', '1 colher (sopa) de aveia'], preparo: ['Amasse e leve ao fogo mexendo até desgrudar da panela.', 'Coma de colher ou enrole depois de frio.'] },
  { id: 'cuscuz', nome: 'Cuscuz com ovo e queijo', tipo: 'Café da manhã', min: 10, kcal: 390, p: 20, c: 46, g: 13, tags: ['vegetariana', 'barata'],
    ingredientes: ['60 g de flocão de milho', '2 ovos', '20 g de queijo branco'], preparo: ['Hidrate o flocão com água e sal e cozinhe no vapor 6 min.', 'Sirva com ovos mexidos e o queijo.'] },
  { id: 'strogonoff', nome: 'Strogonoff fit de frango', tipo: 'Almoço e jantar', min: 25, kcal: 410, p: 40, c: 30, g: 13, tags: ['proteina'],
    ingredientes: ['150 g de frango em cubos', '100 g de iogurte natural', 'Molho de tomate e champignon', '3 colheres (sopa) de arroz'], preparo: ['Doure o frango, junte molho e champignon.', 'Desligue o fogo e misture o iogurte (não ferver). Sirva com o arroz.'] },
];

export const TIPOS_RECEITA: TipoReceita[] = ['Café da manhã', 'Almoço e jantar', 'Lanche', 'Pós-treino', 'Doce'];

// Ordena pelo que mais encaixa no que falta hoje: muita proteína faltando → receitas mais proteicas primeiro.
export function receitasParaHoje(lista: Receita[], faltaKcal: number, faltaProt: number): Receita[] {
  return [...lista].map((r) => {
    const cabe = faltaKcal <= 0 ? 0 : r.kcal <= faltaKcal ? 1 : 0.3;
    const prot = faltaProt > 20 ? r.p / Math.max(r.kcal, 1) * 10 : 0;
    return { r, nota: cabe + prot };
  }).sort((a, b) => b.nota - a.nota).map((x) => x.r);
}
