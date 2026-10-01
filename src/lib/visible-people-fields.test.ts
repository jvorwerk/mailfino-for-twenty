import { describe, expect, it } from 'vitest';

import {
  expandPeopleField,
} from 'src/lib/visible-people-fields';

describe('visible People field metadata', () => {
  it('expands compound and synthetic People fields to mailfino source paths', () => {
    expect(expandPeopleField({ name: 'name', type: 'FULL_NAME' }))
      .toEqual(['name.firstName', 'name.lastName']);
    expect(expandPeopleField({ name: 'emails', type: 'EMAILS' }))
      .toEqual(['emails.primaryEmail']);
    expect(expandPeopleField({ name: 'company', type: 'RELATION' }))
      .toEqual(['companyName']);
    expect(expandPeopleField({ name: 'createdBy', type: 'ACTOR' })).toEqual([]);
  });
});
