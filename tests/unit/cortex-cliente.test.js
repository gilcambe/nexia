'use strict';

const { validateFirebaseToken, validateClientToken, uidDoCaminho, validarAcessoCliente } = require('../../lib/cortex-cliente');

// Mock de Request para testes
function mockRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name] || null,
      ...headers
    }
  };
}

describe('cortex-cliente helper', () => {
  describe('validateFirebaseToken', () => {
    test('deve validar token válido e retornar uid', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJjdXN0b21lci1hIn0.test';
      const payload = {
        uid: 'cliente-a',
        exp: 1234567890
      };
      
      // Criando um token JWT válido
      const jwtToken = Buffer.from(JSON.stringify(payload)).toString('base64');
      const validToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${jwtToken}.test`;
      
      const result = validateFirebaseToken(validToken);
      expect(result).toEqual({ uid: 'cliente-a' });
    });
    
    test('deve lançar erro 401 se token não fornecido', () => {
      expect(() => validateFirebaseToken(null)).toThrow('401: Token não fornecido');
      expect(() => validateFirebaseToken('')).toThrow('401: Token inválido');
    });
    
    test('deve lançar erro 401 se token inválido', () => {
      expect(() => validateFirebaseToken('token.invalido')).toThrow('401: Token inválido');
    });
    
    test('deve lançar erro 401 se token sem uid', () => {
      const payload = { exp: 1234567890 };
      const jwtToken = Buffer.from(JSON.stringify(payload)).toString('base64');
      const tokenWithoutUid = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${jwtToken}.test`;
      
      expect(() => validateFirebaseToken(tokenWithoutUid)).toThrow('401: Token sem UID');
    });
  });
  
  describe('validateClientToken', () => {
    test('deve extrair token do header Authorization', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJjdXN0b21lci1hIn0.test';
      const request = mockRequest({
        'Authorization': `Bearer ${validToken}`
      });
      
      const result = await validateClientToken(request);
      expect(result).toEqual({ uid: 'cliente-a' });
    });
    
    test('deve lançar erro 401 se header Authorization ausente', async () => {
      const request = mockRequest();
      
      await expect(validateClientToken(request)).rejects.toThrow('401: Token não fornecido');
    });
    
    test('deve lançar erro 401 se token não começa com Bearer', async () => {
      const request = mockRequest({
        'Authorization': 'Basic invalid'
      });
      
      await expect(validateClientToken(request)).rejects.toThrow('401: Token não fornecido');
    });
  });
  
  describe('uidDoCaminho', () => {
    test('deve extrair uid do caminho', () => {
      expect(uidDoCaminho('/api/cortex-cliente/cliente-a/conversas')).toBe('cliente-a');
      expect(uidDoCaminho('/api/cortex-cliente/cliente-b/uso')).toBe('cliente-b');
    });
    
    test('deve retornar null se uid não encontrado', () => {
      expect(uidDoCaminho('/api/cortex-cliente/')).toBe(null);
      expect(uidDoCaminho('/api/cortex-cliente')).toBe(null);
      expect(uidDoCaminho('/api/outro/caminho')).toBe(null);
    });
  });
  
  describe('validarAcessoCliente', () => {
    test('deve validar acesso quando uid do token confere com caminho', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJjdXN0b21lci1hIn0.test';
      const request = mockRequest({
        'Authorization': `Bearer ${validToken}`
      });
      
      const result = await validarAcessoCliente(request, '/api/cortex-cliente/cliente-a/conversas');
      expect(result).toEqual({ uid: 'cliente-a' });
    });
    
    test('deve lançar erro 403 se uid do token não confere com caminho', async () => {
      const tokenClienteA = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJjdXN0b21lci1hIn0.test';
      const request = mockRequest({
        'Authorization': `Bearer ${tokenClienteA}`
      });
      
      await expect(validarAcessoCliente(request, '/api/cortex-cliente/cliente-b/conversas'))
        .rejects.toThrow('403: Acesso negado aos dados deste cliente');
    });
    
    test('deve lançar erro 403 se uid não informado no caminho', async () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJjdXN0b21lci1hIn0.test';
      const request = mockRequest({
        'Authorization': `Bearer ${validToken}`
      });
      
      await expect(validarAcessoCliente(request, '/api/cortex-cliente/'))
        .rejects.toThrow('403: UID do cliente não informado no caminho');
    });
  });
});
