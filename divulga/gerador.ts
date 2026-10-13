import fs from 'fs';
import path from 'path';

export interface Cliente {
  id: string;
  nome: string;
  link: string;
  cidade: string;
  assuntos: string[];
  imagens: string[];
  hashtags: string[];
}

export function carregarCliente(caminhoJson: string): Cliente {
  const conteudo = fs.readFileSync(caminhoJson, 'utf-8');
  return JSON.parse(conteudo);
}

export function gerarTextoFallback(cliente: Cliente): string {
  const hashtagsStr = cliente.hashtags.join(' ');
  const assuntoStr = cliente.assuntos.join(' e ');
  return `Conheça o ${cliente.nome} em ${cliente.cidade}! Especialista em ${assuntoStr}. Acesse: ${cliente.link} ${hashtagsStr}`;
}

import Anthropic from '@anthropic-ai/sdk';

export async function gerarTextoIA(cliente: Cliente, promptExtra?: string): Promise<string> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXIA_AI_API_KEY;
    if (!apiKey) {
      return gerarTextoFallback(cliente);
    }

    const anthropic = new Anthropic({ apiKey });
    const prompt = `Crie uma postagem de divulgação atraente e profissional para redes sociais sobre o seguinte cliente:\n` +
      `- Nome: ${cliente.nome}\n` +
      `- Cidade: ${cliente.cidade}\n` +
      `- Assuntos: ${cliente.assuntos.join(', ')}\n` +
      `- Link: ${cliente.link}\n` +
      `- Hashtags: ${cliente.hashtags.join(' ')}\n` +
      (promptExtra ? `Instruções extras: ${promptExtra}\n` : '') +
      `Escreva um texto engajador incluindo as hashtags ao final.`;

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.text) {
      return textContent.text.trim();
    }

    return gerarTextoFallback(cliente);
  } catch (err) {
    return gerarTextoFallback(cliente);
  }
}
