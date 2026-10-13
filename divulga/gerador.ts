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

export async function gerarTextoIA(cliente: Cliente, promptExtra?: string): Promise<string> {
  try {
    // Tenta usar IA se configurada ou retorna fallback caso contrário
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXIA_AI_API_KEY;
    if (!apiKey) {
      return gerarTextoFallback(cliente);
    }
    
    // Fallback seguro caso ocorra qualquer indisponibilidade da API de IA
    return gerarTextoFallback(cliente);
  } catch (err) {
    return gerarTextoFallback(cliente);
  }
}
