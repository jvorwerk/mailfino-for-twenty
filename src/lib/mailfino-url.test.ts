import { describe, expect, it } from 'vitest';

import { mailfinoEndpoint, normalizeMailfinoBaseUrl, resolveMailfinoApiBaseUrl } from 'src/lib/mailfino-url';

describe('normalizeMailfinoBaseUrl', () => {
  it('normalizes HTTPS and approved local development origins', () => {
    expect(normalizeMailfinoBaseUrl('https://mail.example/', 'BASE_URL')).toBe('https://mail.example');
    expect(normalizeMailfinoBaseUrl('http://host.docker.internal:5001', 'BASE_URL'))
      .toBe('http://host.docker.internal:5001');
  });

  it('rejects unsafe origins', () => {
    expect(() => normalizeMailfinoBaseUrl('http://mail.example', 'BASE_URL')).toThrow(/HTTPS/);
    expect(() => normalizeMailfinoBaseUrl('https://mail.example/path', 'BASE_URL')).toThrow(/path/);
    expect(() => normalizeMailfinoBaseUrl('https://user@mail.example', 'BASE_URL')).toThrow(/credentials/);
  });

  it('builds absolute endpoint URLs', () => {
    expect(mailfinoEndpoint('https://mail.example', '/connect/token'))
      .toBe('https://mail.example/connect/token');
  });

  it('uses the public cloud gateway unless a fixture overrides it', () => {
    expect(resolveMailfinoApiBaseUrl(undefined)).toBe('https://app.mailfino.de');
    expect(resolveMailfinoApiBaseUrl('http://host.docker.internal:5001'))
      .toBe('http://host.docker.internal:5001');
  });
});
