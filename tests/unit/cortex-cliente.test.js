'use strict';

const {
  validateFirebaseToken,
  validateClientToken,
  uidDoCaminho,
  validarAcessoCliente
} = require('../../lib/cortex-cliente');

// Simula uma requisição HTTP com headers
function mockRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] || null,
      ...headers
    }
  };
}

describe('cortex-cliente', () => {
  describe('validateFirebaseToken', () => {
    test('deve retornar uid com token válido', () => {
      // Token JWT de teste com uid
      const payload = { uid: 'cliente123', iat: 1234567890, exp: 1234567890 + 3600 };
      const header = { alg: 'HS256', typ: 'JWT' };
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const signature = 'test_signature';
      const token = `${encodedHeader}.${encodedPayload}.${signature}`;
      
      const result = validateFirebaseToken(token);
      expect(result.uid).toBe('cliente123');
    });
    
    test('deve lançar erro 401 com token vazio', () => {
      expect(() => validateFirebaseToken('')).toThrow('401: Token não fornecido');
    });
    
    test('deve lançar erro 401 com token inválido', () => {
      expect(() => validateFirebaseToken('token.invalido')).toThrow('401: Token inválido');
    });
    
    test('deve lançar erro 401 com token sem uid', () => {
      const payload = { iat: 1234567890, exp: 1234567890 + 3600 };
      const header = { alg: 'HS256', typ: 'JWT' };
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const signature = 'test_signature';
      const token = `${encodedHeader}.${encodedPayload}.${signature}`;
      
      expect(() => validateFirebaseToken(token)).toThrow('401: Token sem UID');
    });
  });
  
  describe('validateClientToken', () => {
    test('deve extrair uid do header Authorization', async () => {
      const token = 'test.jwt.token';
      const request = mockRequest({ 'Authorization': `Bearer ${token}` });
      
      // Mock da validateFirebaseToken
      const originalValidate = validateFirebaseToken;
      validateFirebaseToken = jest.fn().mockReturnValue({ uid: 'cliente123' });
      
      const result = await validateClientToken(request);
      expect(result.uid).toBe('cliente123');
      expect(validateFirebaseToken).toHaveBeenCalledWith(token);
      
      // Restaura a função original
      validateFirebaseToken = originalValidate;
    });
    
    test('deve lançar erro 401 sem header Authorization', async () => {
      const request = mockRequest();
      
      await expect(validateClientToken(request)).rejects.toThrow('401: Token não fornecido');
    });
    
    test('deve lançar erro 401 com header Authorization sem Bearer', async () => {
      const request = mockRequest({ 'Authorization': 'Basic token' });
      
      await expect(validateClientToken(request)).rejects.toThrow('401: Token não fornecido');
    });
  });
  
  describe('uidDoCaminho', () => {
    test('deve extrair uid do caminho', () => {
      const pathname = '/api/cortex-cliente/cliente123/conversas';
      const uid = uidDoCaminho(pathname);
      expect(uid).toBe('cliente123');
    });
    
    test('deve retornar null com caminho inválido', () => {
      const pathname = '/api/outro/caminho';
      const uid = uidDoCaminho(pathname);
      expect(uid).toBeNull();
    });
    
    test('deve retornar null com caminho sem uid', () => {
      const pathname = '/api/cortex-cliente/';
      const uid = uidDoCaminho(pathname);
      expect(uid).toBeNull();
    });
  });
  
  describe('validarAcessoCliente', () => {
    test('deve permitir acesso com token e uid correspondentes', async () => {
      const request = mockRequest({ 'Authorization': 'Bearer test.jwt.token' });
      const pathname = '/api/cortex-cliente/cliente123/conversas';
      
      // Mock das funções internas
      const originalValidate = validateClientToken;
      const originalUidDoCaminho = uidDoCaminho;
      
      validateClientToken = jest.fn().mockResolvedValue({ uid: 'cliente123' });
      uidDoCaminho = jest.fn().mockReturnValue('cliente123');
      
      const result = await validarAcessoCliente(request, pathname);
      expect(result.uid).toBe('cliente123');
      
      // Restaura as funções originais
      validateClientToken = originalValidate;
      uidDoCaminho = originalUidDoCaminho;
    });
    
    test('deve lançar erro 401 sem token', async () => {
      const request = mockRequest();
      const pathname = '/api/cortex-cliente/cliente123/conversas';
      
      await expect(validarAcessoCliente(request, pathname)).rejects.toThrow('401: Token não fornecido');
    });
    
    test('deve lançar erro 403 com uid no caminho diferente do token', async () => {
      const request = mockRequest({ 'Authorization': 'Bearer test.jwt.token' });
      const pathname = '/api/cortex-cliente/cliente456/conversas';
      
      // Mock das funções internas
      const originalValidate = validateClientToken;
      const originalUidDoCaminho = uidDoCaminho;
      
      validateClientToken = jest.fn().mockResolvedValue({ uid: 'cliente123' });
      uidDoCaminho = jest.fn().mockReturnValue('cliente456');
      
      await expect(validarAcessoCliente(request, pathname)).rejects.toThrow('403: Acesso negado aos dados deste cliente');
      
      // Restaura as funções originais
      validateClientToken = originalValidate;
      uidDoCaminho = originalUidDoCaminho;
    });
    
    test('deve lançar erro 403 sem uid no caminho', async () => {
      const request = mockRequest({ 'Authorization': 'Bearer test.jwt.token' });
      const pathname = '/api/cortex-cliente/';
      
      // Mock das funções internas
      const originalValidate = validateClientToken;
      const originalUidDoCaminho = uidDoCaminho;
      
      validateClientToken = jest.fn().mockResolvedValue({ uid: 'cliente123' });
      uidDoCaminho = jest.fn().mockReturnValue(null);
      
      await expect(validarAcessoCliente(request, pathname)).rejects.toThrow('403: UID do cliente não informado no caminho');
      
      // Restaura as funções originais
      validateClientToken = originalValidate;
      uidDoCaminho = originalUidDoCaminho;
    });
  });
});
