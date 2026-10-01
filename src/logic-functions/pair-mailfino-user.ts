import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { MAILFINO_PAIR_USER_LOGIC_UNIVERSAL_IDENTIFIER } from 'src/constants';
import { createMailfinoPairing } from 'src/lib/user-access';

/** Creates the one-time mailfino pairing URL for the authenticated Twenty user. */
async function handler(event: RoutePayload<never>) {
  return {
    pairingUrl: await createMailfinoPairing(event.userWorkspaceId, {
      fetch: globalThis.fetch,
      mailfinoBaseUrl: process.env.MAILFINO_BASE_URL,
      appKey: process.env.MAILFINO_APP_KEY,
      twentyBaseUrl: process.env.TWENTY_API_URL,
    }),
  };
}

export default defineLogicFunction({
  universalIdentifier: MAILFINO_PAIR_USER_LOGIC_UNIVERSAL_IDENTIFIER,
  name: 'pair-mailfino-user',
  description: 'Creates a short-lived mailfino account pairing link for the current Twenty user.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/mailfino/pair-user',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
