import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  openSidePanelPage,
  SidePanelPages,
  unmountFrontComponent,
  useLocale,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';
import { useEffect, useRef } from 'react';

import {
  SELECTION_TRANSFER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  TRANSFER_CHOOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants';

/** Captures selected Person IDs before opening the visible chooser with its installed component ID. */
const TransferLauncher = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const locale = useLocale();
  const started = useRef(false);

  useEffect(() => {
    if (started.current)
      return;
    started.current = true;
    void openChooser(selectedRecordIds, locale === 'de-DE' ? 'An mailfino übertragen' : 'Transfer to mailfino');
  }, [selectedRecordIds]);

  return null;
};

/** Stores the short-lived selection and resolves the runtime ID required by Twenty's side-panel API. */
async function openChooser(recordIds: string[], pageTitle: string): Promise<void> {
  await new RestApiClient().post('/s/mailfino/prepare-transfer', { recordIds });
  const metadata = await new MetadataApiClient().query({
    frontComponents: { id: true, universalIdentifier: true },
  });
  const chooser = metadata.frontComponents.find(component =>
    component.universalIdentifier === TRANSFER_CHOOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER);
  if (!chooser)
    throw new Error('The installed mailfino transfer chooser is missing.');
  await openSidePanelPage({
    page: SidePanelPages.ViewFrontComponent,
    frontComponentId: chooser.id,
    pageTitle,
    pageIcon: 'IconSend',
    resetNavigationStack: true,
  });
  await unmountFrontComponent();
}

export default defineFrontComponent({
  universalIdentifier: SELECTION_TRANSFER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'transfer-launcher',
  description: 'Opens the mailfino transfer chooser for selected Twenty People.',
  component: TransferLauncher,
  isHeadless: true,
});
