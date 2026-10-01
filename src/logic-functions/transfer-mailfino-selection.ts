import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { kv } from 'twenty-sdk/logic-function';

import {
  MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX,
  MAILFINO_TRANSFER_PREFERENCE_KEY_PREFIX,
  SELECTION_TRANSFER_LOGIC_UNIVERSAL_IDENTIFIER,
} from 'src/constants';
import { transferMailfinoSelection } from 'src/lib/selection-transfer';
import { resolveMailfinoApiBaseUrl } from 'src/lib/mailfino-url';

type SelectionTransferBody = { mode?: unknown; recordIds?: unknown; fieldScope?: unknown; visibleSourceFields?: unknown; selectionListName?: unknown };

/**
 * Relays the chosen transfer mode and selected Person IDs with the workspace key and server-derived user identity.
 * Triggered by the chooser through Twenty's authenticated /s/ route.
 */
async function handler(event: RoutePayload<SelectionTransferBody>) {
  const mode = event.body?.mode === 'all' ? 'all' : 'selection';
  const fieldScope = event.body?.fieldScope === 'name_email' ? 'name_email' : 'displayed';
  const result = await transferMailfinoSelection(
    mode,
    event.body?.recordIds,
    fieldScope,
    event.body?.visibleSourceFields,
    event.body?.selectionListName,
    event.userWorkspaceId,
    {
      fetch: globalThis.fetch,
      mailfinoBaseUrl: resolveMailfinoApiBaseUrl(process.env.MAILFINO_BASE_URL),
      appKey: process.env.MAILFINO_APP_KEY,
      twentyBaseUrl: process.env.TWENTY_API_URL,
    },
  );
  if (event.userWorkspaceId) {
    await kv.set(
      MAILFINO_TRANSFER_PREFERENCE_KEY_PREFIX + event.userWorkspaceId,
      { fieldScope },
      { scope: 'WORKSPACE' },
    );
    await kv.delete(MAILFINO_TRANSFER_LAUNCH_KEY_PREFIX + event.userWorkspaceId, { scope: 'WORKSPACE' });
  }
  return result;
}

export default defineLogicFunction({
  universalIdentifier: SELECTION_TRANSFER_LOGIC_UNIVERSAL_IDENTIFIER,
  name: 'transfer-mailfino-selection',
  description: 'Transfers all or selected Twenty People through the configured mailfino import profile.',
  timeoutSeconds: 300,
  handler,
  httpRouteTriggerSettings: {
    path: '/mailfino/transfer-selection',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
