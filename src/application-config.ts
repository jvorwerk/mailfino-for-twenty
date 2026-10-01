import { defineApplication } from 'twenty-sdk/define';

import {
  APP_DESCRIPTION,
  APP_DISPLAY_NAME,
  APPLICATION_UNIVERSAL_IDENTIFIER,
} from 'src/constants';

export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: APP_DISPLAY_NAME,
  description: APP_DESCRIPTION,
  author: '4OfficeAutomation GmbH',
  category: 'Marketing',
  logo: 'public/logo.svg',
  galleryImages: [
    'public/marketplace/transfer-chooser.png',
    'public/marketplace/field-scope-result.png',
    'public/marketplace/mailfino-target-list.png',
  ],
  websiteUrl: 'https://www.mailfino.com/',
  termsUrl: 'https://www.mailfino.de/agb/',
  issueReportUrl: 'https://mynewsletterrocks.freshdesk.com/support/tickets/new',
  applicationVariables: {
    MAILFINO_BASE_URL: {
      universalIdentifier: 'c46ecb5f-a546-45cd-8649-a54642cc179a',
      label: 'mailfino URL',
      description: 'URL of the mailfino installation connected to this Twenty workspace.',
      value: 'https://app.mailfino.de',
      isSecret: false,
    },
    MAILFINO_APP_KEY: {
      universalIdentifier: '98161eef-5a2f-49cd-bf8f-ceaf9ba018a3',
      label: 'mailfino app key',
      description: 'Workspace key created on the existing Twenty connection in mailfino.',
      isSecret: true,
    },
  },
});
