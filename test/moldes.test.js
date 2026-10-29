

// Verifica que temos exatamente 10 arquivos de molde
test('existem exatamente 10 arquivos de molde em clientes/_moldes/', () => {
  assert.strictEqual(moldesFiles.length, 10, `esperado 10 moldes, encontrado ${moldesFiles.length}: ${moldesFiles.join(', ')}`);
});

test('deve gerar index.html para cada molde sem erros', async () => {
  const tempDir = path.join(os.tmpdir(), 'test_output_moldes');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const outputDir = path.join(tempDir, path.parse(moldeFile).name);

    fs.mkdirSync(outputDir, { recursive: true });

    try {
      // Executa o script renderizar-site.js como processo externo
      console.log(`Processando molde: ${moldeFile}`);
      console.log(`Comando: node scripts/renderizar-site.js "${moldePath}" "${outputDir}"`);
      
      const { stdout, stderr } = await execAsync(`node scripts/renderizar-site.js "${moldePath}" "${outputDir}"`, {
        timeout: 30000 // 30 segundos de timeout
      });

      console.log(`stdout: ${stdout}`);
      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }

      // Verifica se o index.html foi gerado
      const indexPath = path.join(outputDir, 'index.html');
      assert.ok(fs.existsSync(indexPath), `index.html não gerado para ${moldeFile}`);

      // Verifica se o index.html não está vazio
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      assert.ok(indexContent.length > 0, `index.html vazio para ${moldeFile}`);

      console.log(`Sucesso ao gerar ${indexPath} (${indexContent.length} bytes)`);
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      throw new Error(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    } finally {
      // Remove o diretório temporário deste molde
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    }
  }

  // Remove o diretório temporário principal após os testes
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});