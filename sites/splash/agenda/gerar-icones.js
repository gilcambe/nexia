const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logoPath = path.join(__dirname, '../logo-splash.png');
const outputDir = __dirname;

// Função para criar um ícone com margem transparente (para maskable)
async function createIconWithMargin(inputPath, outputPath, size, margin = 0.1) {
  const logo = sharp(inputPath);
  const metadata = await logo.metadata();
  
  // Calcular o tamanho do conteúdo com base na margem
  const contentSize = Math.floor(size * (1 - 2 * margin));
  
  // Redimensionar o logo para o tamanho do conteúdo
  const resized = await logo.resize(contentSize, contentSize, {
    fit: 'cover',
    position: 'center'
  });
  
  // Criar uma imagem transparente do tamanho final
  const canvas = Buffer.alloc(size * size * 4, 0);
  
  // Combinar a imagem redimensionada com a margem transparente
  const x = Math.floor(size * margin);
  const y = Math.floor(size * margin);
  
  await sharp(canvas)
    .composite([{
      input: await resized.toBuffer(),
      left: x,
      top: y
    }])
    .toFile(outputPath);
}

// Função para criar um ícone simples
async function createIcon(inputPath, outputPath, size) {
  await sharp(inputPath)
    .resize(size, size, {
      fit: 'cover',
      position: 'center'
    })
    .toFile(outputPath);
}

async function generateIcons() {
  try {
    // Verificar se o arquivo de logo existe
    if (!fs.existsSync(logoPath)) {
      throw new Error(`Arquivo de logo não encontrado: ${logoPath}`);
    }
    
    console.log('Gerando ícones...');
    
    // Criar ícone 192x192
    await createIcon(logoPath, path.join(outputDir, 'icone-192.png'), 192);
    console.log('Ícone 192x192 criado');
    
    // Criar ícone 512x512
    await createIcon(logoPath, path.join(outputDir, 'icone-512.png'), 512);
    console.log('Ícone 512x512 criado');
    
    // Criar ícone maskable 512x512 com margem de 10%
    await createIconWithMargin(logoPath, path.join(outputDir, 'icone-maskable-512.png'), 512, 0.1);
    console.log('Ícone maskable 512x512 criado');
    
    console.log('Todos os ícones foram gerados com sucesso!');
  } catch (error) {
    console.error('Erro ao gerar ícones:', error.message);
    process.exit(1);
  }
}

generateIcons();