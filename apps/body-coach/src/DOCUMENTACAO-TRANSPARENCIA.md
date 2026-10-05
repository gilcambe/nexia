# NEXIA Body Coach AI — Documento de Transparência e Confiabilidade

> Este documento explica, de forma honesta e completa, COMO o site foi construído, DE ONDE vieram as informações, o QUE é real e o QUE é simulado, e como avaliar se você pode confiar nele.

---

## 1. O que é este projeto?

**NEXIA Body Coach AI** é um painel (dashboard) de acompanhamento esportivo. Ele mostra, em telas separadas:

| Tela | O que faz |
|------|-----------|
| Home | Visão geral do atleta (readiness, treino do dia, nutrição do dia, continuidade, evolução) |
| Treino | Lista de exercícios com séries, repetições e carga |
| Nutrição | Registro de refeições, macros, água e gráfico de tendência semanal |
| Evolução | **Body Twin** (corpo em IA/foto), gráficos de peso/força, recordes e comparação de fotos |
| Plano | Plano de treino do atleta |
| Perfil | Dados e histórico médico do atleta |

**IMPORTANTE:** Este é um **protótipo/demonstração** de interface. Ele roda **100% no navegador** (frontend), **sem backend**, **sem banco de dados real** e **sem conexão com nenhum serviço externo** neste momento.

---

## 2. De onde vieram as informações? (a pergunta mais importante)

### 2.1 Os dados do atleta são FICTÍCIOS (mock data)

Todos os números que você vê — nome, idade, peso, medidas, refeições, prontidão, força — **foram inventados** para demonstrar a interface. Eles estão em arquivos chamados "mocks" (dados de exemplo):

- `src/mocks/athlete.ts` → "Rafael Moreira", 29 anos, 82.4 kg, 178 cm, 16% gordura. **Personagem fictício.**
- `src/mocks/nutrition.ts` → refeições e metas de macro. **Números de exemplo.**
- `src/mocks/evolution.ts` → medidas, peso, força, recordes. **Dados de exemplo.**
- `src/mocks/workout.ts`, `src/mocks/plan.ts`, `src/mocks/coach.ts` → treinos e planos. **Exemplos.**

**O que isso significa:** o site NÃO está lendo dados de um atleta real. Ele mostra dados "de mentira" para você ver como a interface funciona.

### 2.2 Nada é salvo permanentemente

- Quando você registra uma refeição na tela de Nutrição, ela fica apenas na memória do navegador enquanto a página está aberta.
- Ao recarregar a página, os dados voltam ao estado inicial (mock).
- **Não há login, não há banco de dados, não há persistência real.**

Na versão NEXIA, quem cria conta (e-mail e senha) tem os dados salvos no Firebase (Auth + Firestore). O acesso de teste (admin / admin01) continua 100% no navegador, sem backend.

---

## 3. O Body Twin: de onde veio e como foi feito

### 3.1 O que é o Body Twin?

É o "boneco" de corpo que aparece na tela de Evolução. Ele tem três modos:

1. **Corpo IA** — imagens geradas por inteligência artificial (2 estilos: fotorrealista e render 3D), com rotação 360°.
2. **Foto real** — o aluno faz upload da própria foto.
3. **Comparar** — divisor antes/depois entre corpo atual e meta.

### 3.2 De onde vieram as imagens do corpo?

**As imagens NÃO foram "achadas" na internet e NÃO são de uma pessoa real.** Elas foram **geradas na hora** por um modelo de IA de geração de imagens (Stable Diffusion), pela plataforma onde o app foi prototipado. Na versão NEXIA, as imagens que existiam foram copiadas para o próprio app (`public/imagens/`).

Cada imagem é criada a partir de um texto (prompt) que descreve: "homem atlético, ~29 anos, sem camisa, shorts pretos, fundo de estúdio neutro, corpo inteiro...". Ou seja:

- **O corpo do Body Twin é 100% artificial.** Não existe essa pessoa.
- As imagens são coerentes entre si porque os prompts foram escritos com o mesmo estilo (mesmo fundo, mesma iluminação, mesma pose).

### 3.3 O "modo meta" (12% gordura) também é gerado por IA

O corpo "na meta" é outra imagem gerada por IA com o prompt alterado para "corpo com gordura corporal baixa, ~12%, músculos definidos". **Não é uma transformação real do atleta** — é uma imagem nova, parecida, mas mais "seca".

### 3.4 O que NÃO é real (honestidade total)

| Promessa | Realidade |
|----------|-----------|
| "Escaneamento 3D real" | **Não existe.** É uma simulação visual com imagens 2D. Um scan 3D de verdade (fotos → malha 3D girável) exige IA na nuvem + backend. |
| Medidas exatas do corpo | **São estimativas.** O valor real (ex.: cintura 84 cm) é mock. A nova "estimativa automática" usa a largura da silhueta em pixels ÷ altura conhecida, convertida em cm — é uma **aproximação geométrica**, não uma medição médica. |
| "16% gordura" | **Número inventado** (mock), não medido. |

### 3.5 Como funciona a "estimativa automática de medidas" (novidade)

Quando você sobe uma foto e clica em "Estimar medidas automaticamente":

1. A imagem é carregada e desenhada num canvas (área de desenho do navegador).
2. O código detecta a **silhueta** (corpo vs. fundo) comparando a cor de cada pixel com a cor do fundo.
3. Para cada linha da imagem, calcula a **largura da silhueta em pixels**.
4. Usa a **altura real conhecida (178 cm)** como "régua": se o corpo tem 1000 pixels de altura e a pessoa tem 178 cm, cada pixel vale 0.178 cm.
5. Multiplica a largura em pixels das regiões (ombro, cintura, quadril, pescoço) por essa escala → resultado em cm.
6. Aplica o **método da Marinha (Navy)** para estimar o % de gordura a partir de pescoço, cintura e altura.

**Limitações honestas:** a precisão depende muito da foto (fundo uniforme, corpo inteiro, posição reta). É uma **referência visual**, não substitui fita métrica nem avaliação profissional.

---

## 4. Como o site foi construído (tecnologia)

### 4.1 Stack (ferramentas)

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Interface (UI) | React | 19.1.0 |
| Linguagem | TypeScript | ~5.8 |
| Estilo | Tailwind CSS | 3.4.17 |
| Gráficos | Recharts | 3.2.0 |
| Roteamento | React Router DOM | 7.6.3 |
| Ícones | Remix Icon + Font Awesome (via CDN) | 4.5.0 / 6.4.0 |
| Build | Vite | 8.0.1 |
| Internacionalização | i18next | 25.4.1 |

Dependências que estão instaladas mas **não são usadas ativamente** (herdadas do template): lucide-react. (Na versão NEXIA, Supabase e Stripe foram removidos e o Firebase passou a ser o backend.)

### 4.2 Estrutura de arquivos

```
src/
├── components/
│   ├── base/          → componentes genéricos (Card, etc.)
│   └── feature/       → componentes reutilizáveis (AppShell, CoachContext, NutritionContext...)
├── mocks/             → DADOS FICTÍCIOS (athlete, nutrition, evolution, workout, plan, coach)
├── pages/
│   ├── home/          → tela inicial
│   ├── workout/       → treino
│   ├── nutrition/     → nutrição
│   ├── evolution/     → Body Twin + gráficos
│   ├── plan/          → plano
│   ├── profile/       → perfil
│   └── onboarding/    → onboarding
├── router/            → configuração de rotas
├── i18n/              → internacionalização
├── App.tsx            → raiz do app
└── main.tsx           → ponto de entrada
```

### 4.3 Principais padrões de código

- **Contexto compartilhado** (`NutritionContext`) → faz a Home e a tela de Nutrição lerem/escreverem os MESMOS dados (por isso registrar refeição numa reflete na outra).
- **Estilo visual** → minimalismo, sem sombras, cantos arredondados (8px cards / 6px botões), fontes refinadas, sem azul/roxo (usamos laranja/verde/neutros).
- **Responsividade** → pensado para desktop primeiro, com adaptação para mobile.

---

## 5. "Métricas" (números do projeto)

| Métrica | Valor |
|---------|-------|
| Páginas (telas) | 7 principais + NotFound |
| Componentes | ~20+ |
| Arquivos de dados (mocks) | 6 |
| Backend conectado | **Nenhum** (0) |
| Banco de dados real | **Nenhum** (0) |
| Login/autenticação | **Não implementado** |
| Pagamento/assinatura | **Não implementado** |
| Persistência de dados | **Não há** (tudo em memória) |

**Conclusão sobre métricas:** é um protótipo de interface, não um produto em produção. Não há usuários reais, não há tráfego, não há dados coletados.

---

## 6. É confiável? (resposta direta)

### ✅ O que é confiável
- **O código é real e funcional** — é React + TypeScript padrão, você pode abrir, ler e rodar.
- **A interface é bonita e coerente** — segue boas práticas de design.
- **Nada é escondido** — todo o código está visível na aba de Código.

### ⚠️ O que NÃO é (e você precisa saber)
1. **Os dados do atleta são fictícios.** Não há um "Rafael" real.
2. **O Body Twin é gerado por IA.** Não é um scan real, não é uma pessoa real, e a transformação "atual → meta" é uma troca de imagem, não uma evolução real do corpo.
3. **As medidas estimadas são aproximações.** Não substituem medição profissional.
4. **Não há backend.** Nada é salvo, não há usuários, não há autenticação.

### 🎯 Resumo para sua decisão
Este projeto é **confiável como demonstração de interface e design**. Ele NÃO é — e nunca foi vendido como — um sistema médico, um scanner corporal real ou um produto com dados reais. Se o objetivo é **mostrar como seria o visual e a experiência**, ele cumpre. Se o objetivo é **usar com atletas reais e dados reais**, falta conectar backend, autenticação e banco de dados.

---

## 7. Como ver todo o código (linha por linha)

Para analisar, copiar ou baixar todos os arquivos do projeto, use a tela **Código** do próprio app (menu lateral). Lá você navega por todos os arquivos `.tsx`, `.ts`, `package.json`, `index.html`, etc., com botão de copiar e baixar.

---

*Documento gerado em 09/09/2026 para fins de transparência. Nenhuma informação foi omitida sobre a natureza fictícia dos dados e a origem das imagens geradas por IA.*