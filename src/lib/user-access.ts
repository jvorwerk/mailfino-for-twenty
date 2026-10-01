import { mailfinoEndpoint, normalizeMailfinoBaseUrl } from 'src/lib/mailfino-url';

export type MailfinoUserLinkStatus = {
  linked: boolean;
  mailfinoAccount: string;
  openUrl: string;
};

type UserAccessDependencies = {
  fetch: typeof globalThis.fetch;
  mailfinoBaseUrl: string | undefined;
  appKey: string | undefined;
  twentyBaseUrl: string | undefined;
};

/** Loads the current Twenty user's assignment without exposing the workspace app key to the front component. */
export async function loadMailfinoUserLink(
  userWorkspaceId: string | null,
  dependencies: UserAccessDependencies,
): Promise<MailfinoUserLinkStatus> {
  const context = requireContext(userWorkspaceId, dependencies);
  const response = await dependencies.fetch(mailfinoEndpoint(context.mailfinoBaseUrl, '/api/integrations/v1/twenty/user-link'), {
    headers: appHeaders(context.appKey, context.twentyBaseUrl, context.userWorkspaceId),
  });
  if (!response.ok)
    throw new Error(`mailfino user-link request failed with HTTP ${response.status}.`);
  return parseUserLink(await response.json(), context.mailfinoBaseUrl);
}

/** Creates a short-lived pairing URL for the authenticated Twenty user. */
export async function createMailfinoPairing(
  userWorkspaceId: string | null,
  dependencies: UserAccessDependencies,
): Promise<string> {
  const context = requireContext(userWorkspaceId, dependencies);
  const response = await dependencies.fetch(mailfinoEndpoint(context.mailfinoBaseUrl, '/api/integrations/v1/twenty/pairings'), {
    method: 'POST',
    headers: appHeaders(context.appKey, context.twentyBaseUrl, context.userWorkspaceId),
  });
  if (!response.ok)
    throw new Error(`mailfino pairing request failed with HTTP ${response.status}.`);
  const value = await response.json() as { pairingUrl?: unknown };
  return readSameOriginUrl(value?.pairingUrl, context.mailfinoBaseUrl, 'pairing URL');
}

/** Creates a validated context from application variables and server-derived Twenty identity. */
function requireContext(userWorkspaceId: string | null, dependencies: UserAccessDependencies) {
  if (!userWorkspaceId)
    throw new Error('The authenticated Twenty user is missing.');
  const appKey = dependencies.appKey?.trim() ?? '';
  if (!appKey.startsWith('mf_twenty_') || appKey.length > 512)
    throw new Error('MAILFINO_APP_KEY is missing or invalid.');
  return {
    userWorkspaceId,
    appKey,
    mailfinoBaseUrl: normalizeMailfinoBaseUrl(dependencies.mailfinoBaseUrl, 'MAILFINO_BASE_URL'),
    twentyBaseUrl: normalizeMailfinoBaseUrl(dependencies.twentyBaseUrl, 'TWENTY_API_URL'),
  };
}

/** Builds the headers accepted only by mailfino's dedicated Twenty app authentication path. */
function appHeaders(appKey: string, twentyBaseUrl: string, userWorkspaceId: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${appKey}`,
    'X-Twenty-Base-Url': twentyBaseUrl,
    'X-Twenty-User-Workspace-Id': userWorkspaceId,
  };
}

/** Validates the deliberately small assignment response and its credential-free same-origin launch URL. */
function parseUserLink(value: unknown, mailfinoBaseUrl: string): MailfinoUserLinkStatus {
  if (!value || typeof value !== 'object')
    throw new Error('mailfino returned an invalid user-link response.');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.linked !== 'boolean' || typeof candidate.mailfinoAccount !== 'string' || typeof candidate.openUrl !== 'string')
    throw new Error('mailfino returned an incomplete user-link response.');
  return {
    linked: candidate.linked,
    mailfinoAccount: candidate.mailfinoAccount,
    openUrl: candidate.linked ? readSameOriginUrl(candidate.openUrl, mailfinoBaseUrl, 'launch URL') : '',
  };
}

/** Accepts only credential-free URLs on the configured mailfino origin. */
function readSameOriginUrl(value: unknown, baseUrl: string, label: string): string {
  let url: URL;
  try {
    url = new URL(typeof value === 'string' ? value : '');
  } catch {
    throw new Error(`mailfino returned an invalid ${label}.`);
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.origin !== new URL(baseUrl).origin)
    throw new Error(`mailfino returned an unsafe ${label}.`);
  return url.toString();
}
