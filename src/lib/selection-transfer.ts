import { mailfinoEndpoint, normalizeMailfinoBaseUrl } from 'src/lib/mailfino-url';

const maxRecordIds = 500;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MailfinoSelectionTransferResult = {
  listId: number;
  listName: string;
  requestedCount: number;
  transferredCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  failedCount: number;
  duplicateCount: number;
  openUrl: string;
};

export type MailfinoTransferMode = 'all' | 'selection';
export type MailfinoTransferFieldScope = 'displayed' | 'name_email';

export type MailfinoTransferReadiness = {
  account: string;
  ready: boolean;
  connectionReady: boolean;
  importProfileReady: boolean;
  emailMappingReady: boolean;
  connectionName: string;
  importProfileName: string;
  emailSourceField: string;
  personalizationFieldCount: number;
  mappedSourceFields: string[];
  targetCategoryName: string;
  targetRecordCount: number;
  statusCode: string;
};

export type SelectionTransferDependencies = {
  fetch: typeof globalThis.fetch;
  mailfinoBaseUrl: string | undefined;
  appKey: string | undefined;
  twentyBaseUrl: string | undefined;
};

/**
 * Requests either the normal profile sync or a bounded selected-ID transfer with the workspace app key.
 * Contact values and Twenty credentials never cross this boundary.
 */
export async function transferMailfinoSelection(
  mode: MailfinoTransferMode,
  recordIds: unknown,
  fieldScope: MailfinoTransferFieldScope,
  visibleSourceFields: unknown,
  selectionListName: unknown,
  userWorkspaceId: string | null,
  dependencies: SelectionTransferDependencies,
): Promise<MailfinoSelectionTransferResult> {
  const normalizedRecordIds = mode === 'selection' ? normalizeRecordIds(recordIds) : [];
  const normalizedSourceFields = fieldScope === 'displayed' ? normalizeSourceFields(visibleSourceFields) : [];
  const normalizedSelectionListName = mode === 'selection' ? normalizeSelectionListName(selectionListName) : '';
  if (!userWorkspaceId)
    throw new Error('The authenticated Twenty user is missing.');
  const apiBaseUrl = normalizeMailfinoBaseUrl(dependencies.mailfinoBaseUrl, 'MAILFINO_BASE_URL');
  const appKey = requireAppKey(dependencies.appKey);
  const twentyBaseUrl = normalizeMailfinoBaseUrl(dependencies.twentyBaseUrl, 'TWENTY_API_URL');
  const response = await dependencies.fetch(
    mailfinoEndpoint(apiBaseUrl, '/api/integrations/v1/twenty/selection-transfers'),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${appKey}`,
        'Content-Type': 'application/json',
        'X-Twenty-Base-Url': twentyBaseUrl,
        'X-Twenty-User-Workspace-Id': userWorkspaceId,
      },
      body: JSON.stringify({
        mode,
        fieldScope,
        sourceBaseUrl: twentyBaseUrl,
        recordIds: normalizedRecordIds,
        visibleSourceFields: normalizedSourceFields,
        selectionListName: normalizedSelectionListName,
      }),
    },
  );
  if (!response.ok)
    throw new Error(`mailfino selection transfer failed with HTTP ${response.status}.`);

  return parseTransferResult(
    await response.json(),
    mode === 'selection' ? normalizedRecordIds.length : null,
    new URL(apiBaseUrl).origin,
  );
}

/** Normalizes the optional static-list name without allowing control characters or oversized UI input. */
function normalizeSelectionListName(value: unknown): string {
  if (value === undefined || value === null)
    return '';
  if (typeof value !== 'string')
    throw new Error('The selection list name is invalid.');
  const name = value.trim();
  if (name.length > 100 || [...name].some(character => /[\u0000-\u001F\u007F]/.test(character)))
    throw new Error('The selection list name is invalid.');
  return name;
}

/** Validates the metadata-derived Twenty field paths before the server intersects them with the saved mapping. */
function normalizeSourceFields(value: unknown): string[] {
  if (!Array.isArray(value))
    throw new Error('The visible Twenty fields are invalid.');
  const fields = [...new Set(value
    .filter((field): field is string => typeof field === 'string')
    .map(field => field.trim())
    .filter(Boolean))];
  if (fields.length === 0 || fields.length > 100 || fields.some(field => field.length > 160 || !/^[A-Za-z0-9_.]+$/.test(field)))
    throw new Error('The visible Twenty fields are invalid.');
  return fields;
}

/** Loads the non-secret mailfino readiness contract with the workspace app key and Twenty user identity. */
export async function loadMailfinoTransferReadiness(
  userWorkspaceId: string | null,
  dependencies: SelectionTransferDependencies,
): Promise<MailfinoTransferReadiness> {
  if (!userWorkspaceId)
    throw new Error('The authenticated Twenty user is missing.');
  const apiBaseUrl = normalizeMailfinoBaseUrl(dependencies.mailfinoBaseUrl, 'MAILFINO_BASE_URL');
  const appKey = requireAppKey(dependencies.appKey);
  const twentyBaseUrl = normalizeMailfinoBaseUrl(dependencies.twentyBaseUrl, 'TWENTY_API_URL');
  const readinessUrl = new URL(mailfinoEndpoint(apiBaseUrl, '/api/integrations/v1/twenty/readiness'));
  readinessUrl.searchParams.set('sourceBaseUrl', twentyBaseUrl);
  const response = await dependencies.fetch(readinessUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${appKey}`,
      'X-Twenty-Base-Url': twentyBaseUrl,
      'X-Twenty-User-Workspace-Id': userWorkspaceId,
    },
  });
  if (!response.ok)
    throw new Error(`mailfino transfer readiness failed with HTTP ${response.status}.`);

  return parseTransferReadiness(await response.json());
}

/** Rejects absent or malformed workspace credentials before an external request is attempted. */
function requireAppKey(value: string | undefined): string {
  const appKey = value?.trim() ?? '';
  if (!appKey.startsWith('mf_twenty_') || appKey.length > 512)
    throw new Error('MAILFINO_APP_KEY is missing or invalid.');
  return appKey;
}

/** Validates and deduplicates selected Person IDs before they leave the Twenty workspace. */
function normalizeRecordIds(value: unknown): string[] {
  if (!Array.isArray(value))
    throw new Error('The Twenty record selection is invalid.');

  const recordIds = [...new Set(value
    .filter((recordId): recordId is string => typeof recordId === 'string')
    .map(recordId => recordId.trim().toLowerCase())
    .filter(Boolean))];
  if (recordIds.length === 0 || recordIds.length > maxRecordIds || recordIds.some(recordId => !uuidPattern.test(recordId)))
    throw new Error('Select between 1 and 500 Twenty People records.');
  return recordIds;
}

/** Keeps the browser-facing response deliberately small and rejects unsafe or incomplete launch URLs. */
function parseTransferResult(
  value: unknown,
  expectedRequestedCount: number | null,
  expectedOrigin: string,
): MailfinoSelectionTransferResult {
  if (!value || typeof value !== 'object')
    throw new Error('mailfino returned an invalid selection transfer response.');

  const candidate = value as Record<string, unknown>;
  let openUrl: URL;
  try {
    openUrl = new URL(typeof candidate.openUrl === 'string' ? candidate.openUrl : '');
  } catch {
    throw new Error('mailfino returned an invalid open URL.');
  }
  if (!['https:', 'http:'].includes(openUrl.protocol) || openUrl.username || openUrl.password || openUrl.origin !== expectedOrigin)
    throw new Error('mailfino returned an unsafe open URL.');
  if (
    typeof candidate.listId !== 'number' || !Number.isInteger(candidate.listId) || candidate.listId <= 0 ||
    typeof candidate.listName !== 'string' || !candidate.listName.trim() ||
    typeof candidate.requestedCount !== 'number' || !Number.isInteger(candidate.requestedCount) || candidate.requestedCount < 0 ||
    (expectedRequestedCount !== null && candidate.requestedCount !== expectedRequestedCount) ||
    typeof candidate.transferredCount !== 'number' || !Number.isInteger(candidate.transferredCount) ||
    candidate.transferredCount < 0 || candidate.transferredCount > candidate.requestedCount ||
    !areValidCounters(candidate, ['createdCount', 'updatedCount', 'unchangedCount', 'skippedCount', 'failedCount', 'duplicateCount'])
  ) {
    throw new Error('mailfino returned an incomplete selection transfer response.');
  }
  if (openUrl.searchParams.get('selectlist') !== String(candidate.listId))
    throw new Error('mailfino returned a list URL for the wrong transfer result.');

  return {
    listId: candidate.listId,
    listName: candidate.listName.trim(),
    requestedCount: candidate.requestedCount,
    transferredCount: candidate.transferredCount,
    createdCount: candidate.createdCount as number,
    updatedCount: candidate.updatedCount as number,
    unchangedCount: candidate.unchangedCount as number,
    skippedCount: candidate.skippedCount as number,
    failedCount: candidate.failedCount as number,
    duplicateCount: candidate.duplicateCount as number,
    openUrl: openUrl.toString(),
  };
}

/** Checks bounded non-negative integer counters in a mailfino transfer result. */
function areValidCounters(candidate: Record<string, unknown>, names: string[]): boolean {
  return names.every(name => typeof candidate[name] === 'number' && Number.isInteger(candidate[name]) && (candidate[name] as number) >= 0);
}

/** Parses the deliberately non-secret readiness response and rejects incomplete upstream contracts. */
function parseTransferReadiness(value: unknown): MailfinoTransferReadiness {
  if (!value || typeof value !== 'object')
    throw new Error('mailfino returned an invalid transfer readiness response.');

  const candidate = value as Record<string, unknown>;
  const stringFields = ['account', 'connectionName', 'importProfileName', 'emailSourceField', 'targetCategoryName', 'statusCode'] as const;
  if (
    stringFields.some(field => typeof candidate[field] !== 'string') ||
    typeof candidate.ready !== 'boolean' ||
    typeof candidate.connectionReady !== 'boolean' ||
    typeof candidate.importProfileReady !== 'boolean' ||
    typeof candidate.emailMappingReady !== 'boolean' ||
    typeof candidate.personalizationFieldCount !== 'number' ||
    !Number.isInteger(candidate.personalizationFieldCount) || candidate.personalizationFieldCount < 0 ||
    !Array.isArray(candidate.mappedSourceFields) ||
    candidate.mappedSourceFields.some(field => typeof field !== 'string' || !/^[A-Za-z0-9_.]+$/.test(field)) ||
    typeof candidate.targetRecordCount !== 'number' || !Number.isInteger(candidate.targetRecordCount) || candidate.targetRecordCount < 0
  ) {
    throw new Error('mailfino returned an incomplete transfer readiness response.');
  }

  return {
    account: String(candidate.account),
    ready: candidate.ready,
    connectionReady: candidate.connectionReady,
    importProfileReady: candidate.importProfileReady,
    emailMappingReady: candidate.emailMappingReady,
    connectionName: String(candidate.connectionName),
    importProfileName: String(candidate.importProfileName),
    emailSourceField: String(candidate.emailSourceField),
    personalizationFieldCount: candidate.personalizationFieldCount,
    mappedSourceFields: [...new Set(candidate.mappedSourceFields as string[])],
    targetCategoryName: String(candidate.targetCategoryName),
    targetRecordCount: candidate.targetRecordCount,
    statusCode: String(candidate.statusCode),
  };
}
