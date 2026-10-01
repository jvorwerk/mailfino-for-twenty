import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';
import type { LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { PEOPLE_ACCESS_PROBE_UNIVERSAL_IDENTIFIER } from 'src/constants';

type TwentyPeoplePage = {
  data?: {
    people?: unknown[];
  };
};

/**
 * Proves that Twenty injects a short-lived, role-scoped application token that can read People.
 * Invoked manually by the integration spike; it never returns or persists the injected token.
 */
export async function probeTwentyPeopleAccess(
  _payload: Record<string, never>,
  context: LogicFunctionExecutionContext,
) {
  const client = new RestApiClient({ runAs: 'application' });
  const page = await client.get<TwentyPeoplePage>('/rest/people', {
    query: { limit: 1 },
  });
  const people = page.data?.people;

  if (!Array.isArray(people))
    throw new Error('Twenty returned an invalid People response.');

  return {
    workspaceId: context.workspaceId,
    peopleRead: true,
    sampleCount: people.length,
  };
}

export default defineLogicFunction({
  universalIdentifier: PEOPLE_ACCESS_PROBE_UNIVERSAL_IDENTIFIER,
  name: 'probe-twenty-people-access',
  description: 'Verifies the role-scoped Twenty People read path without exporting credentials.',
  timeoutSeconds: 15,
  handler: probeTwentyPeopleAccess,
});
