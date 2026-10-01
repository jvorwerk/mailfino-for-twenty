import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import {
  MAILFINO_LAUNCH_CONTEXT_LOGIC_UNIVERSAL_IDENTIFIER,
  MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX,
  MAILFINO_TRANSFER_PREFERENCE_KEY_PREFIX,
} from 'src/constants';
import { resolveMailfinoApiBaseUrl } from 'src/lib/mailfino-url';
import {
  loadMailfinoTransferReadiness,
  type MailfinoTransferReadiness,
} from 'src/lib/selection-transfer';
import { loadMailfinoUserLink } from 'src/lib/user-access';

/** Returns the trusted mailfino launch, preserved selection, and per-user assignment readiness for the chooser. */
async function handler(event: RoutePayload<never>) {
  const apiBaseUrl = resolveMailfinoApiBaseUrl(process.env.MAILFINO_BASE_URL);
  let userLink = { linked: false, mailfinoAccount: '', openUrl: '' };
  try {
    userLink = await loadMailfinoUserLink(event.userWorkspaceId, {
      fetch: globalThis.fetch,
      mailfinoBaseUrl: apiBaseUrl,
      appKey: process.env.MAILFINO_APP_KEY,
      twentyBaseUrl: process.env.TWENTY_API_URL,
    });
  } catch {
    userLink = { linked: false, mailfinoAccount: '', openUrl: '' };
  }
  const hasPersonalConnection = userLink.linked;
  let readiness: MailfinoTransferReadiness | null = null;
  if (hasPersonalConnection && event.userWorkspaceId) {
    try {
      readiness = await loadMailfinoTransferReadiness(event.userWorkspaceId, {
        fetch: globalThis.fetch,
        mailfinoBaseUrl: apiBaseUrl,
        appKey: process.env.MAILFINO_APP_KEY,
        twentyBaseUrl: process.env.TWENTY_API_URL,
      });
    } catch {
      readiness = null;
    }
  }
  const launch = event.userWorkspaceId
    ? await kv.get<{ recordIds?: unknown; viewId?: unknown; createdAt?: unknown }>(MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX + event.userWorkspaceId, { scope: 'WORKSPACE' })
    : null;
  const createdAt = typeof launch?.createdAt === 'string' ? Date.parse(launch.createdAt) : 0;
  const isFresh = Number.isFinite(createdAt) && Date.now() - createdAt < 10 * 60 * 1000;
  const recordIds = isFresh && Array.isArray(launch?.recordIds)
    ? launch.recordIds.filter((recordId): recordId is string => typeof recordId === 'string')
    : [];
  const viewId = isFresh && typeof launch?.viewId === 'string' ? launch.viewId : null;
  const preference = event.userWorkspaceId
    ? await kv.get<{ fieldScope?: unknown }>(MAILFINO_TRANSFER_PREFERENCE_KEY_PREFIX + event.userWorkspaceId, { scope: 'WORKSPACE' })
    : null;
  const preferredFieldScope = readPreferredFieldScope(preference?.fieldScope);
  return { openUrl: userLink.openUrl, recordIds, viewId, preferredFieldScope, hasPersonalConnection, readiness };
}

/** Restores only one supported field-scope preference and safely defaults older or malformed KV values. */
export function readPreferredFieldScope(value: unknown): 'displayed' | 'name_email' {
  return value === 'name_email' ? 'name_email' : 'displayed';
}

export default defineLogicFunction({
  universalIdentifier: MAILFINO_LAUNCH_CONTEXT_LOGIC_UNIVERSAL_IDENTIFIER,
  name: 'get-mailfino-launch-context',
  description: 'Returns the mailfino launch context and assigned-user readiness without exposing credentials.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/mailfino/launch-context',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
