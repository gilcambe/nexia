const fs = require('fs');
const path = require('path');

const providersDir = path.join(__dirname, '../src/providers');

async function checkFreeIAModels() {
  const providers = fs.readdirSync(providersDir).filter(file => file.startsWith('ia-') && file.endsWith('.js'));

  for (const providerFile of providers) {
    const providerPath = path.join(providersDir, providerFile);
    const provider = require(providerPath);

    try {
      const response = await fetch(`${provider.baseUrl}/models`);
      if (!response.ok) {
        console.error(`Erro ao consultar modelos do provedor ${provider.name}: ${response.statusText}`);
        continue;
      }

      const models = await response.json();
      if (!models.includes(provider.testModel)) {
        console.warn(`Modelo de teste ${provider.testModel} não encontrado para o provedor ${provider.name}`);
        // Enviar aviso para a Central
        await fetch('https://central.nexia.ai/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Modelo de teste ${provider.testModel} não encontrado para o provedor ${provider.name}`,
          }),
        });
      }
    } catch (error) {
      console.error(`Erro ao verificar modelos do provedor ${provider.name}: ${error.message}`);
    }
  }
}

checkFreeIAModels();