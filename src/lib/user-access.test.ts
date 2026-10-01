import { describe, expect, it, vi } from 'vitest';

import { createMailfinoPairing, loadMailfinoUserLink } from 'src/lib/user-access';

const userId = '01991c42-1234-7000-8000-123456789abd';
const dependencies = {
  fetch: vi.fn() as typeof globalThis.fetch,
  mailfinoBaseUrl: 'https://app.mailfino.test',
  appKey: 'mf_twenty_workspace-secret',
  twentyBaseUrl: 'https://crm.example.test',
};

describe('mailfino user access', () => {
  it('loads a linked account with app-only headers and validates its launch origin', async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer mf_twenty_workspace-secret',
        'X-Twenty-User-Workspace-Id': userId,
      });
      return new Response(JSON.stringify({
        linked: true,
        mailfinoAccount: 'owner_subaccount',
        openUrl: 'https://app.mailfino.test/#tk=single-use',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const result = await loadMailfinoUserLink(userId, { ...dependencies, fetch: fetch as typeof globalThis.fetch });
    expect(result).toMatchObject({ linked: true, mailfinoAccount: 'owner_subaccount' });
  });

  it('returns only a same-origin one-time pairing URL', async () => {
    const pairingUrl = await createMailfinoPairing(userId, {
      ...dependencies,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        pairingUrl: 'https://app.mailfino.test/?mode=twentypair&pairing=secret',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof globalThis.fetch,
    });
    expect(pairingUrl).toContain('mode=twentypair');
  });

  it('rejects a pairing URL redirected to another installation', async () => {
    await expect(createMailfinoPairing(userId, {
      ...dependencies,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        pairingUrl: 'https://attacker.example/pair',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof globalThis.fetch,
    })).rejects.toThrow('unsafe pairing URL');
  });
});
