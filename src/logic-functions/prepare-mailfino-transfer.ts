import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import {
  MAILFINO_PREPARE_TRANSFER_LOGIC_UNIVERSAL_IDENTIFIER,
  MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX,
} from 'src/constants';

type PrepareTransferBody = { recordIds?: unknown };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Temporarily preserves selected Person IDs while Twenty switches from a headless command to the chooser. */
async function handler(event: RoutePayload<PrepareTransferBody>) {
  if (!event.userWorkspaceId)
    throw new Error('The authenticated Twenty user is missing.');
  const recordIds = Array.isArray(event.body?.recordIds)
    ? [...new Set(event.body.recordIds.filter((value): value is string => typeof value === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)))]
    : [];
  if (recordIds.length === 0 || recordIds.length > 500)
    throw new Error('Select between 1 and 500 People.');
  const viewId = readPeopleViewIdFromHeaders(event.headers);
  if (!viewId)
    throw new Error('The active Twenty People view could not be identified.');
  await kv.set(
    MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX + event.userWorkspaceId,
    { recordIds, viewId, createdAt: new Date().toISOString() },
    { scope: 'WORKSPACE' },
  );
  return { prepared: true, selectedCount: recordIds.length };
}

/** Extracts the active People view from the authenticated host page that invoked the headless action. */
export function readPeopleViewIdFromHeaders(headers: Record<string, string | undefined>): string | null {
  const referer = Object.entries(headers)
    .find(([name]) => name.toLowerCase() === 'referer')?.[1];
  try {
    const url = new URL(referer ?? '');
    if (!/^\/objects\/people\/?$/i.test(url.pathname))
      return null;
    const viewId = url.searchParams.get('viewId') ?? '';
    return uuidPattern.test(viewId) ? viewId.toLowerCase() : null;
  } catch {
    return null;
  }
}

export default defineLogicFunction({
  universalIdentifier: MAILFINO_PREPARE_TRANSFER_LOGIC_UNIVERSAL_IDENTIFIER,
  name: 'prepare-mailfino-transfer',
  description: 'Preserves selected Twenty Person IDs briefly while the transfer chooser opens.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/mailfino/prepare-transfer',
    httpMethod: 'POST',
    isAuthRequired: true,
    forwardedRequestHeaders: ['referer'],
  },
});
