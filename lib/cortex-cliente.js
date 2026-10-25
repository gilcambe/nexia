import https from 'https';
import { createHash } from 'crypto';
import { TextEncoder, TextDecoder } from 'util';

// Cache simples das chaves públicas do Google
const publicKeysCache = {
  keys: [],
  timestamp: 0,
  ttl: 60 * 60 * 1000, // 1 hora
};

// Função para obter as chaves públicas do Google com cache
async function getFirebasePublicKeys() {
  const now = Date.now();
  
  // Retorna as chaves do cache se ainda forem válidas
  if (publicKeysCache.keys.length > 0 && (now - publicKeysCache.timestamp) < publicKeysCache.ttl) {
    return publicKeysCache.keys;
  }
  
  // Busca novas chaves do JWKS endpoint do Google
  return new Promise((resolve, reject) => {
    const url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
    
    const req = https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Falha ao obter chaves públicas: ${res.statusCode}`));
          return;
        }
        
        try {
          const keys = JSON.parse(data);
          const keyArray = Object.keys(keys).map(kid => ({
            kid,
            key: keys[kid],
            algorithm: 'RS256'
          }));
          
          // Atualiza o cache
          publicKeysCache.keys = keyArray;
          publicKeysCache.timestamp = now;
          
          resolve(keyArray);
        } catch (error) {
          reject(new Error(`Erro ao processar chaves públicas: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Erro de rede ao obter chaves públicas: ${error.message}`));
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout ao obter chaves públicas'));
    });
  });
}

// Função para decodificar o header de um JWT
function decodeJwtHeader(token) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token JWT inválido: formato incorreto');
  }
  
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return header;
  } catch (error) {
    throw new Error(`Erro ao decodificar header do JWT: ${error.message}`);
  }
}

// Função para verificar a assinatura JWT
async function verifyJwtSignature(token, publicKey) {
  const parts = token.split('.');
  const header = decodeJwtHeader(token);
  const signature = parts[2];
  
  // Verifica se o KID do token corresponde à chave
  if (header.kid !== publicKey.kid) {
    throw new Error(`KID do token (${header.kid}) não corresponde à chave disponível (${publicKey.kid})`);
  }
  
  // Prepara os dados para verificação
  const data = `${parts[0]}.${parts[1]}`;
  
  // Converte a chave pública para formato PEM
  const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKey.key}\n-----END PUBLIC KEY-----`;
  
  // Usa a Web Crypto API para verificar a assinatura
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signatureBuffer = Buffer.from(signature, 'base64url');
  
  return new Promise((resolve, reject) => {
    crypto.subtle.importKey(
      'spki',
      Buffer.from(pemKey.replace(/-----BEGIN PUBLIC KEY-----\n|\n-----END PUBLIC KEY-----/g, ''), 'base64'),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    ).then((key) => {
      crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        key,
        signatureBuffer,
        dataBuffer
      ).then((valid) => {
        if (valid) {
          resolve();
        } else {
          reject(new Error('Assinatura JWT inválida'));
        }
      }).catch((error) => {
        reject(new Error(`Erro ao verificar assinatura: ${error.message}`));
      });
    }).catch((error) => {
      reject(new Error(`Erro ao importar chave: ${error.message}`));
    });
  });
}

// Função principal para verificar o token do Firebase
export async function verifyFirebaseToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token JWT inválido: token não fornecido ou não é string');
  }
  
  // Remove o prefixo 'Bearer ' se existir
  const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
  
  // Divide o token em partes
  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Token JWT inválido: formato incorreto');
  }
  
  // Decodifica o payload sem verificar a assinatura primeiro
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch (error) {
    throw new Error(`Erro ao decodificar payload do JWT: ${error.message}`);
  }
  
  // Valida campos obrigatórios
  if (!payload.iss || !payload.aud || !payload.sub || !payload.exp) {
    throw new Error('Token JWT inválido: campos obrigatórios ausentes (iss, aud, sub, exp)');
  }
  
  // Valida emissor (issuer)
  const expectedIss = `https://securetoken.google.com/${payload.aud}`;
  if (payload.iss !== expectedIss) {
    throw new Error(`Emissor inválido: esperado ${expectedIss}, recebido ${payload.iss}`);
  }
  
  // Valida expiração
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error(`Token expirado em ${new Date(payload.exp * 1000).toISOString()}`);
  }
  
  // Valida issued-at (opcional, mas bom para ter certeza)
  if (payload.iat && payload.iat > now) {
    throw new Error('Token emitido no futuro');
  }
  
  // Obtém as chaves públicas
  const publicKeys = await getFirebasePublicKeys();
  
  // Tenta verificar com cada chave até encontrar a correta
  let lastError;
  for (const publicKey of publicKeys) {
    try {
      await verifyJwtSignature(cleanToken, publicKey);
      // Se chegou aqui, a assinatura é válida
      return payload.sub; // Retorna o uid (sub)
    } catch (error) {
      lastError = error;
      continue; // Tenta com a próxima chave
    }
  }
  
  // Se nenhuma chave funcionou, lança o último erro
  throw new Error(`Falha ao verificar assinatura do JWT: ${lastError.message}`);
}

// Middleware para extrair o token do request e verificar
export function getUidFromRequest(request) {
  return new Promise((resolve, reject) => {
    try {
      // Extrai o token do header Authorization
      const authHeader = request.headers?.authorization;
      
      if (!authHeader) {
        reject({
          status: 401,
          message: 'Token de autenticação não fornecido'
        });
        return;
      }
      
      // Verifica se é um token Bearer
      if (!authHeader.startsWith('Bearer ')) {
        reject({
          status: 401,
          message: 'Formato de token inválido. Esperado: Authorization: Bearer <token>'
        });
        return;
      }
      
      const token = authHeader.substring(7); // Remove 'Bearer '
      
      // Verifica o token
      verifyFirebaseToken(token)
        .then((uid) => {
          resolve(uid);
        })
        .catch((error) => {
          reject({
            status: 401,
            message: `Token inválido: ${error.message}`
          });
        });
    } catch (error) {
      reject({
        status: 401,
        message: `Erro ao processar token: ${error.message}`
      });
    }
  });
}

// Exporta também a função de cache para testes
export { getFirebasePublicKeys };
