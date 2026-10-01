import { defineCommandMenuItem, numberOfSelectedRecords, STANDARD_OBJECT } from 'twenty-sdk/define';

import {
  SELECTION_TRANSFER_COMMAND_UNIVERSAL_IDENTIFIER,
  SELECTION_TRANSFER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants';

export default defineCommandMenuItem({
  universalIdentifier: SELECTION_TRANSFER_COMMAND_UNIVERSAL_IDENTIFIER,
  label: 'An mailfino übertragen',
  shortLabel: 'An mailfino',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
  conditionalAvailabilityExpression: numberOfSelectedRecords > 0,
  frontComponentUniversalIdentifier: SELECTION_TRANSFER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
