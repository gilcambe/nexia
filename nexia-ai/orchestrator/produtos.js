// Mapa de produto: cada produto com os diretorios que lhe pertencem.
// Usado pelo orchestrator para descobrir os arquivos de cada produto.
module.exports = {
  "Kernex Finance": ["prumo/", "netlify/functions/prumo", "netlify/functions/prumo-lib", "tests/unit/prumo-"],
  "Central/Cortex": ["src/"],
  "Body Coach": ["apps/body-coach/"],
  "Viajante": ["viajante-pro/"]
};

