const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// caminho relativo ao diretório deste teste
const htmlPath = path.join(__dirname, '../../apps/body-coach/index.html');

/**
 * Helper que extrai o atributo content de uma meta tag pelo property.
 */
function getMetaContent(html, property) {
  const regex = new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

test('Atualização das tags Open Graph em apps/body-coach/index.html', (t) => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Caso comum: as tags devem existir e conter o novo domínio.
  const ogUrl = getMetaContent(html, 'og:url');
  const ogImage = getMetaContent(html, 'og:image');

  assert.ok(ogUrl, 'Tag meta[property="og:url"] deve existir');
  assert.ok(ogImage, 'Tag meta[property="og:image"] deve existir');

  // 1️⃣ Asserção: domínio atualizado em og:url
  assert.ok(
    ogUrl.startsWith('https://bodycoach.kernex.com.br'),
    `og:url deve iniciar com https://bodycoach.kernex.com.br, encontrado: ${ogUrl}`
  );

  // 2️⃣ Asserção: domínio atualizado em og:image
  assert.ok(
    ogImage.startsWith('https://bodycoach.kernex.com.br'),
    `og:image deve iniciar com https://bodycoach.kernex.com.br, encontrado: ${ogImage}`
  );

  // 3️⃣ Asserção de borda: caminho após o domínio permanece o mesmo (/body-coach/...)
  assert.ok(
    ogUrl.includes('/body-coach/'),
    `og:url deve conter o caminho /body-coach/, encontrado: ${ogUrl}`
  );
  assert.ok(
    ogImage.includes('/body-coach/'),
    `og:image deve conter o caminho /body-coach/, encontrado: ${ogImage}`
  );

  // 4️⃣ Asserção de integridade: nenhum trecho antigo do domínio deve permanecer no arquivo.
  assert.ok(
    !html.includes('nexiabodycoach.pages.dev'),
    'O domínio antigo nexiabodycoach.pages.dev não deve aparecer em nenhum lugar do arquivo.'
  );

  // 5️⃣ Asserção de contagem: cada tag deve aparecer exatamente uma vez.
  const ogUrlCount = (html.match(/<meta\s+property="og:url"/gi) || []).length;
  const ogImageCount = (html.match(/<meta\s+property="og:image"/gi) || []).length;
  assert.strictEqual(ogUrlCount, 1, 'Deve existir exatamente uma tag meta[property="og:url"]');
  assert.strictEqual(ogImageCount, 1, 'Deve existir exatamente uma tag meta[property="og:image"]');
});