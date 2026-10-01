import { describe, expect, it } from 'vitest';

import { readPeopleViewIdFromHeaders } from 'src/logic-functions/prepare-mailfino-transfer';

describe('prepare mailfino transfer view context', () => {
  it('reads the active People view from Twenty forwarded request headers', () => {
    const viewId = '01991c42-1234-7000-8000-123456789abc';
    expect(readPeopleViewIdFromHeaders({
      Referer: `https://crm.example.test/objects/people?viewId=${viewId}`,
    })).toBe(viewId);
  });

  it('rejects referers outside the People table', () => {
    expect(readPeopleViewIdFromHeaders({
      referer: 'https://crm.example.test/objects/companies?viewId=01991c42-1234-7000-8000-123456789abc',
    })).toBeNull();
  });
});
