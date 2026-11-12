import axios from 'axios';
import cheerio from 'cheerio';

// Função para obter cotação do Yahoo Finance
async function getYahooFinanceQuote(ticker) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`;
    try {
        const response = await axios.get(url);
        const data = response.data.quoteResponse.result[0];

        if (!data) {
            throw new Error(\`Ticker ${ticker} não encontrado no Yahoo Finance.\`);
        }

        return {
            ticker: data.symbol,
            preco: data.regularMarketPrice,
            variacao_dia_pct: data.regularMarketChangePercent,
            fonte: 'Yahoo Finance',
            data_hora: new Date(data.regularMarketTime * 1000),
        };
    } catch (error) {
        console.error(\`Erro ao buscar cotação do Yahoo Finance para ${ticker}: \`, error);
        throw new Error(\`Falha ao buscar cotação do Yahoo Finance para ${ticker}.\`);
    }
}

// Função para obter cotação da BrAPI
async function getBrAPICallQuote(ticker) {
    // A BrAPI pode exigir um token de autenticação.
    // A URL abaixo é um exemplo e pode precisar de ajustes dependendo da implementação específica da BrAPI.
    // Considere buscar o token do secret BRAPI_TOKEN se necessário.
    const brapiUrl = \`https://brapi.dev/api/v2/quote/\${ticker}?range=1d&interval=1d&fundamental=true\`; 
    try {
        const response = await axios.get(brapiUrl);
        const data = response.data.results[0];

        if (!data) {
            throw new Error(\`Ticker ${ticker} não encontrado na BrAPI.\`);
        }

        return {
            ticker: data.symbol,
            preco: data.regularMarketPrice,
            variacao_dia_pct: data.change, // BrAPI pode retornar a variação absoluta, que pode precisar ser convertida para percentual
            fonte: 'BrAPI',
            data_hora: new Date(data.regularMarketTime * 1000),
        };
    } catch (error) {
        console.error(\`Erro ao buscar cotação da BrAPI para ${ticker}: \`, error);
        throw new Error(\`Falha ao buscar cotação da BrAPI para ${ticker}.\`);
    }
}

// Função para obter cotação do Google Finance (parsing de HTML)
async function getGoogleFinanceQuote(ticker) {
    const url = \`https://www.google.com/finance/quote/\${ticker}:BOVESPA\`; // Assumindo Bovespa, pode precisar de ajuste
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        // Os seletores CSS abaixo são exemplos e podem precisar de ajustes com base na estrutura HTML atual do Google Finance.
        const preco = parseFloat($('div[data-last-price]').attr('data-last-price'));
        const variacao = parseFloat($('span[data-change-percent]').attr('data-change-percent'));

        if (isNaN(preco) || isNaN(variacao)) {
            throw new Error(\`Não foi possível parsear os dados do Google Finance para ${ticker}.\`);
        }

        return {
            ticker: ticker.toUpperCase(),
            preco: preco,
            variacao_dia_pct: variacao,
            fonte: 'Google Finance',
            data_hora: new Date(), // Google Finance não fornece um timestamp claro para a última atualização no HTML parsado de forma simples
        };
    } catch (error) {
        console.error(\`Erro ao buscar cotação do Google Finance para ${ticker}: \`, error);
        throw new Error(\`Falha ao buscar cotação do Google Finance para ${ticker}.\`);
    }
}

// Função principal que tenta as fontes na ordem com fallback
export async function getQuoteFromSources(ticker) {
    const sources = [
        getYahooFinanceQuote,
        getBrAPICallQuote,
        getGoogleFinanceQuote,
    ];

    for (const source of sources) {
        try {
            const quote = await source(ticker);
            // Verifica se os dados essenciais foram retornados
            if (quote && quote.preco != null && quote.variacao_dia_pct != null) {
                return quote;
            }
        } catch (error) {
            console.warn(\`Fonte falhou ou não retornou dados válidos: \${source.name}. \${error.message}\`);
            // Continua para a próxima fonte
        }
    }

    throw new Error(\`Não foi possível obter a cotação para o ticker ${ticker} de nenhuma fonte.\`);
}
