import { onRequest } from '../apps/body-coach/pages-proxy/functions/[[path]]';

describe('Proxy Redirect Tests', () => {
  const createRequest = (path, hostname = 'nexiabodycoach.pages.dev', method = 'GET', headers = {}) => {
    const url = new URL(`https://${hostname}${path}`);
    return new Request(url.toString(), { method, headers });
  };

  test('GET /body-coach/ from nexiabodycoach.pages.dev redirects to bodycoach.kernex.com.br', async () => {
    const request = createRequest('/body-coach/', 'nexiabodycoach.pages.dev', 'GET', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://bodycoach.kernex.com.br/body-coach/');
  });

  test('GET /asset.png from nexiabodycoach.pages.dev does not redirect', async () => {
    const request = createRequest('/asset.png', 'nexiabodycoach.pages.dev', 'GET', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });

  test('GET /.well-known/assetlinks.json from nexiabodycoach.pages.dev does not redirect', async () => {
    const request = createRequest('/.well-known/assetlinks.json', 'nexiabodycoach.pages.dev', 'GET', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });

  test('GET /api/data from nexiabodycoach.pages.dev does not redirect', async () => {
    const request = createRequest('/api/data', 'nexiabodycoach.pages.dev', 'GET', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });

  test('POST /body-coach/ from nexiabodycoach.pages.dev does not redirect', async () => {
    const request = createRequest('/body-coach/', 'nexiabodycoach.pages.dev', 'POST', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });

  test('GET /body-coach/ from other host does not redirect', async () => {
    const request = createRequest('/body-coach/', 'otherhost.com', 'GET', { 'Accept': 'text/html' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });

  test('GET /body-coach/ with non-HTML Accept header does not redirect', async () => {
    const request = createRequest('/body-coach/', 'nexiabodycoach.pages.dev', 'GET', { 'Accept': 'application/json' });
    const response = await onRequest({ request });
    expect(response.status).not.toBe(301);
  });
});
