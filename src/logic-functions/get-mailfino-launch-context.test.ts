import { describe, expect, it } from 'vitest';

import { readPreferredFieldScope } from 'src/logic-functions/get-mailfino-launch-context';

describe('mailfino transfer preference', () => {
  it('restores supported scopes and defaults malformed values', () => {
    expect(readPreferredFieldScope('name_email')).toBe('name_email');
    expect(readPreferredFieldScope('displayed')).toBe('displayed');
    expect(readPreferredFieldScope('unexpected')).toBe('displayed');
  });
});
