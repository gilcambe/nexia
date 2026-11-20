    const [r, vl] = await Promise.all([MB.api('beneficios_resumo'), MB.api('vale_listar').catch(() => ({ vales: [], total: 0 }))]);
