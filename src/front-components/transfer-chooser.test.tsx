import { describe, expect, it } from 'vitest';

import {
  readableFieldLabel,
  requiresLargeTransferConfirmation,
  resolveEffectiveSourceFields,
} from 'src/front-components/transfer-chooser';

describe('mailfino transfer chooser decisions', () => {
  it('previews only displayed fields that are mapped and always retains e-mail', () => {
    expect(resolveEffectiveSourceFields(
      'displayed',
      ['name.firstName', 'jobTitle', 'createdAt'],
      new Set(['name.firstName', 'jobTitle', 'emails.primaryEmail']),
      'emails.primaryEmail',
    )).toEqual(['name.firstName', 'jobTitle', 'emails.primaryEmail']);
  });

  it('limits the compact scope to mapped name and e-mail fields', () => {
    expect(resolveEffectiveSourceFields(
      'name_email',
      ['companyName'],
      new Set(['name.firstName', 'name.lastName', 'companyName', 'emails.primaryEmail']),
      'emails.primaryEmail',
    )).toEqual(['name.firstName', 'name.lastName', 'emails.primaryEmail']);
  });

  it('uses explicit thresholds for large-transfer confirmation', () => {
    expect(requiresLargeTransferConfirmation('selection', 99, 0)).toBe(false);
    expect(requiresLargeTransferConfirmation('selection', 100, 0)).toBe(true);
    expect(requiresLargeTransferConfirmation('all', 0, 999)).toBe(false);
    expect(requiresLargeTransferConfirmation('all', 0, 1000)).toBe(true);
  });

  it('uses localized common labels and metadata labels for custom fields', () => {
    expect(readableFieldLabel('name.firstName', 'Name', true)).toBe('Vorname');
    expect(readableFieldLabel('customInterest', 'Produktinteresse', true)).toBe('Produktinteresse');
  });
});
