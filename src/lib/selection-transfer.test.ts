import { describe, expect, it, vi } from 'vitest';

import { loadMailfinoTransferReadiness, transferMailfinoSelection } from 'src/lib/selection-transfer';

const recordId = '01991c42-1234-7000-8000-123456789abc';
const userId = '01991c42-1234-7000-8000-123456789abd';
const dependencies = {
  fetch: vi.fn() as typeof globalThis.fetch,
  mailfinoBaseUrl: 'https://app.mailfino.test',
  appKey: 'mf_twenty_workspace-secret',
  twentyBaseUrl: 'https://crm.example.test',
};
const resultCounters = { createdCount: 1, updatedCount: 0, unchangedCount: 0, skippedCount: 0, failedCount: 0, duplicateCount: 0 };

describe('transferMailfinoSelection', () => {
  it('uses the workspace key and Twenty identity without sending contact values', async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer mf_twenty_workspace-secret',
        'X-Twenty-Base-Url': 'https://crm.example.test',
        'X-Twenty-User-Workspace-Id': userId,
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        mode: 'selection', fieldScope: 'displayed', sourceBaseUrl: 'https://crm.example.test',
        recordIds: [recordId], visibleSourceFields: ['name.firstName', 'emails.primaryEmail'], selectionListName: 'VIP contacts',
      });
      return new Response(JSON.stringify({
        listId: 42, listName: 'Twenty-Auswahl', requestedCount: 1, transferredCount: 1,
        ...resultCounters, openUrl: 'https://app.mailfino.test/?selectlist=42#tk=one-time',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    const result = await transferMailfinoSelection(
      'selection', [recordId.toUpperCase(), recordId], 'displayed',
      ['name.firstName', 'emails.primaryEmail'], '  VIP contacts  ', userId,
      { ...dependencies, fetch: fetch as typeof globalThis.fetch },
    );
    expect(result).toMatchObject({ listId: 42, transferredCount: 1 });
  });

  it('rejects malformed selections before making a request', async () => {
    const fetch = vi.fn();
    await expect(transferMailfinoSelection(
      'selection', ['not-a-person-id'], 'displayed', ['emails.primaryEmail'], '', userId,
      { ...dependencies, fetch: fetch as typeof globalThis.fetch },
    )).rejects.toThrow('record');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires the dedicated app key before making a request', async () => {
    await expect(transferMailfinoSelection(
      'all', [], 'name_email', [], '', userId, { ...dependencies, appKey: '' },
    )).rejects.toThrow('MAILFINO_APP_KEY');
  });

  it('rejects a launch URL from a different mailfino origin', async () => {
    await expect(transferMailfinoSelection('all', [], 'name_email', [], '', userId, {
      ...dependencies,
      fetch: vi.fn(async () => new Response(JSON.stringify({
        listId: 43, listName: 'TwentyCRM', requestedCount: 12, transferredCount: 12,
        ...resultCounters, openUrl: 'https://other.example.test/?selectlist=43',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof globalThis.fetch,
    })).rejects.toThrow('unsafe open URL');
  });
});

describe('loadMailfinoTransferReadiness', () => {
  it('loads the existing import profile with the app-key headers', async () => {
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(new URL(String(url)).pathname).toBe('/api/integrations/v1/twenty/readiness');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer mf_twenty_workspace-secret' });
      return new Response(JSON.stringify({
        account: 'owner', ready: true, connectionReady: true, importProfileReady: true,
        emailMappingReady: true, connectionName: 'Twenty CRM', importProfileName: 'People',
        emailSourceField: 'emails.primaryEmail', personalizationFieldCount: 3,
        mappedSourceFields: ['emails.primaryEmail'], targetCategoryName: 'People', targetRecordCount: 12, statusCode: 'ready',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const result = await loadMailfinoTransferReadiness(userId, { ...dependencies, fetch: fetch as typeof globalThis.fetch });
    expect(result).toMatchObject({ ready: true, targetRecordCount: 12 });
  });
});
