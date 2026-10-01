import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { useLocale, useSelectedRecordIds } from 'twenty-sdk/front-component';
import { useEffect, useMemo, useState } from 'react';

import { TRANSFER_CHOOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants';
import type {
  MailfinoSelectionTransferResult,
  MailfinoTransferReadiness,
  MailfinoTransferFieldScope,
  MailfinoTransferMode,
} from 'src/lib/selection-transfer';
import { loadPeopleViewFieldsForView } from 'src/lib/visible-people-fields';

type LaunchContext = {
  openUrl: string;
  hasPersonalConnection?: boolean;
  readiness?: MailfinoTransferReadiness | null;
};
type TransferLaunchContext = LaunchContext & {
  recordIds?: string[];
  viewId?: string | null;
  preferredFieldScope?: MailfinoTransferFieldScope;
};

const largeSelectionThreshold = 100;
const largeProfileThreshold = 1000;

const copy = {
  de: {
    title: 'An mailfino übertragen',
    intro: 'Wähle Felder und Ziel. Die Einstellung gilt für beide Übertragungsarten.',
    fields: 'Felder übertragen',
    displayedFields: 'Angezeigte Felder übertragen',
    displayedFieldsHint: 'Verwendet alle in dieser Twenty-Ansicht eingeblendeten und in mailfino zugeordneten Felder. Dazu zählen auch Spalten rechts außerhalb des sichtbaren Ausschnitts.',
    nameEmail: 'Nur Name und E-Mail übertragen',
    nameEmailHint: 'Übernimmt ausschließlich Vorname, Nachname und die primäre E-Mail-Adresse.',
    fieldsUnavailable: 'Die eingeblendeten Felder der aktuellen Twenty-Ansicht konnten nicht ermittelt werden.',
    preview: 'Tatsächlich übertragene Felder',
    unmapped: 'In Twenty eingeblendet, aber in mailfino nicht zugeordnet',
    all: 'Alle aus Importprofil übertragen',
    allHint: (name: string, count: number) => count > 0
      ? `Synchronisiert das Importprofil in „${name}“ (derzeit ${count} Kontakte).`
      : `Synchronisiert das konfigurierte Importprofil in „${name}“.`,
    selected: 'Markierte übertragen',
    selectedHint: (count: number) => count === 1 ? 'Überträgt den markierten Kontakt in eine neue statische Liste.' : `Überträgt ${count} markierte Kontakte in eine neue statische Liste.`,
    selectedEmpty: 'Markiere zuerst mindestens einen Kontakt.',
    selectedTooMany: 'Es können höchstens 500 markierte Kontakte übertragen werden.',
    selectionListName: 'Name der neuen Liste für Markierte',
    selectionListPlaceholder: 'Automatisch: Twenty-Auswahl …',
    personalConnectionRequired: 'Ordne diesem Twenty-Nutzer einmalig ein mailfino-Konto zu.',
    pairAccount: 'mailfino-Konto zuordnen',
    pairingReady: 'Zuordnung in mailfino abschließen',
    pairingFailed: 'Der Zuordnungslink konnte nicht erstellt werden. Prüfe URL und App-Schlüssel in den App-Einstellungen.',
    open: 'mailfino öffnen',
    openList: 'Verwendete Liste in mailfino öffnen',
    ready: 'Bereit für die Übertragung',
    account: 'mailfino-Konto',
    profile: 'Importprofil',
    profileTarget: 'Ziel für alle',
    email: 'E-Mail-Feld',
    personalization: 'Personalisierungsfelder',
    notReady: 'Die Übertragung ist noch nicht bereit. Prüfe die Twenty-Anbindung, das aktive People-Importprofil und die E-Mail-Feldzuordnung in mailfino.',
    loading: 'Kontakte werden übertragen …',
    success: (count: number, listName: string) => `${count} Kontakte wurden in „${listName}“ verarbeitet.`,
    error: 'Die Kontakte konnten nicht übertragen werden. Auswahl, Feldmodus und Listenname bleiben erhalten.',
    retry: 'Erneut versuchen',
    confirmTitle: 'Große Übertragung bestätigen',
    confirmSelection: (count: number, fields: number) => `${count} markierte Kontakte werden mit ${fields} Feldern übertragen.`,
    confirmAll: (count: number, fields: number) => `Die Zielliste enthält derzeit ${count} Kontakte. Das Importprofil wird mit ${fields} Feldern erneut synchronisiert.`,
    confirm: 'Jetzt übertragen',
    cancel: 'Abbrechen',
    result: 'Ergebnis',
    transferred: 'Verarbeitet',
    created: 'Neu angelegt',
    updated: 'Aktualisiert',
    unchanged: 'Unverändert',
    skipped: 'Übersprungen',
    failed: 'Fehlgeschlagen',
    duplicates: 'Duplikate',
  },
  en: {
    title: 'Transfer to mailfino',
    intro: 'Choose fields and destination. The setting applies to both transfer actions.',
    fields: 'Transfer fields',
    displayedFields: 'Transfer displayed fields',
    displayedFieldsHint: 'Uses all columns enabled in this Twenty view and mapped in mailfino, including columns to the right of the current viewport.',
    nameEmail: 'Transfer name and e-mail only',
    nameEmailHint: 'Transfers only first name, last name, and the primary e-mail address.',
    fieldsUnavailable: 'The enabled fields of the current Twenty view could not be determined.',
    preview: 'Fields actually transferred',
    unmapped: 'Displayed in Twenty but not mapped in mailfino',
    all: 'Transfer all from import profile',
    allHint: (name: string, count: number) => count > 0
      ? `Synchronizes the import profile into “${name}” (currently ${count} contacts).`
      : `Synchronizes the configured import profile into “${name}”.`,
    selected: 'Transfer selected',
    selectedHint: (count: number) => count === 1 ? 'Transfers the selected contact into a new static list.' : `Transfers ${count} selected contacts into a new static list.`,
    selectedEmpty: 'Select at least one contact first.',
    selectedTooMany: 'At most 500 selected contacts can be transferred.',
    selectionListName: 'New list name for selected contacts',
    selectionListPlaceholder: 'Automatic: Twenty selection …',
    personalConnectionRequired: 'Assign a mailfino account to this Twenty user once.',
    pairAccount: 'Assign mailfino account',
    pairingReady: 'Complete assignment in mailfino',
    pairingFailed: 'The assignment link could not be created. Check the URL and app key in the app settings.',
    open: 'Open mailfino',
    openList: 'Open used list in mailfino',
    ready: 'Ready to transfer',
    account: 'mailfino account',
    profile: 'Import profile',
    profileTarget: 'Destination for all',
    email: 'E-mail field',
    personalization: 'Personalization fields',
    notReady: 'The transfer is not ready yet. Check the Twenty connection, enabled People import profile, and e-mail field mapping in mailfino.',
    loading: 'Transferring contacts …',
    success: (count: number, listName: string) => `${count} contacts were processed in “${listName}”.`,
    error: 'The contacts could not be transferred. Selection, field mode, and list name have been preserved.',
    retry: 'Try again',
    confirmTitle: 'Confirm large transfer',
    confirmSelection: (count: number, fields: number) => `${count} selected contacts will be transferred with ${fields} fields.`,
    confirmAll: (count: number, fields: number) => `The destination currently contains ${count} contacts. The import profile will be synchronized again with ${fields} fields.`,
    confirm: 'Transfer now',
    cancel: 'Cancel',
    result: 'Result',
    transferred: 'Processed',
    created: 'Created',
    updated: 'Updated',
    unchanged: 'Unchanged',
    skipped: 'Skipped',
    failed: 'Failed',
    duplicates: 'Duplicates',
  },
};

/** Renders the supported hand-off actions after the headless launcher preserved the current selection. */
const TransferChooser = () => {
  const locale = useLocale();
  const contextRecordIds = useSelectedRecordIds();
  const isGerman = locale === 'de-DE';
  const text = isGerman ? copy.de : copy.en;
  const [selectedRecordIds, setSelectedRecordIds] = useState(contextRecordIds);
  const [visibleSourceFields, setVisibleSourceFields] = useState<string[]>([]);
  const [visibleFieldLabels, setVisibleFieldLabels] = useState<Record<string, string>>({});
  const [fieldScope, setFieldScope] = useState<MailfinoTransferFieldScope>('displayed');
  const [selectionListName, setSelectionListName] = useState('');
  const [openUrl, setOpenUrl] = useState('');
  const [contextLoaded, setContextLoaded] = useState(false);
  const [hasPersonalConnection, setHasPersonalConnection] = useState(false);
  const [pairingUrl, setPairingUrl] = useState('');
  const [pairingFailed, setPairingFailed] = useState(false);
  const [readiness, setReadiness] = useState<MailfinoTransferReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedMode, setFailedMode] = useState<MailfinoTransferMode | null>(null);
  const [confirmationMode, setConfirmationMode] = useState<MailfinoTransferMode | null>(null);
  const [result, setResult] = useState<MailfinoSelectionTransferResult | null>(null);
  const selectedCount = selectedRecordIds.length;
  const mappedSourceFields = useMemo(() => new Set(readiness?.mappedSourceFields ?? []), [readiness?.mappedSourceFields]);
  const effectiveSourceFields = useMemo(
    () => resolveEffectiveSourceFields(fieldScope, visibleSourceFields, mappedSourceFields, readiness?.emailSourceField ?? ''),
    [fieldScope, visibleSourceFields, mappedSourceFields, readiness?.emailSourceField],
  );
  const unmappedSourceFields = useMemo(
    () => fieldScope === 'displayed' ? visibleSourceFields.filter(field => !mappedSourceFields.has(field)) : [],
    [fieldScope, visibleSourceFields, mappedSourceFields],
  );
  const displayedFieldsUnavailable = fieldScope === 'displayed' && visibleSourceFields.length === 0;
  const transferDisabled = !contextLoaded || !hasPersonalConnection || readiness?.ready !== true || loading || displayedFieldsUnavailable;
  const selectionDisabled = selectedCount === 0 || selectedCount > 500 || transferDisabled;

  useEffect(() => {
    void (async () => {
      try {
        const context = await new RestApiClient().get<TransferLaunchContext>('/s/mailfino/launch-context');
        setOpenUrl(readSafeOpenUrl(context?.openUrl));
        setHasPersonalConnection(context?.hasPersonalConnection === true);
        setReadiness(context?.readiness?.ready === true ? context.readiness : context?.readiness ?? null);
        setFieldScope(context?.preferredFieldScope === 'name_email' ? 'name_email' : 'displayed');
        if (Array.isArray(context?.recordIds))
          setSelectedRecordIds(context.recordIds.filter(recordId => typeof recordId === 'string'));
        if (typeof context?.viewId === 'string') {
          try {
            const fields = await loadPeopleViewFieldsForView(context.viewId);
            setVisibleSourceFields(fields.sourceFields);
            setVisibleFieldLabels(fields.labels);
          } catch {
            setVisibleSourceFields([]);
            setVisibleFieldLabels({});
          }
        }
      } catch {
        setOpenUrl('');
        setHasPersonalConnection(false);
        setReadiness(null);
      } finally {
        setContextLoaded(true);
      }
    })();
  }, []);

  /** Executes the chosen transfer through Twenty's authenticated server route and preserves retry state on failure. */
  const transfer = async (mode: MailfinoTransferMode) => {
    setLoading(true);
    setFailedMode(null);
    setConfirmationMode(null);
    setResult(null);
    try {
      const response = await new RestApiClient().post<MailfinoSelectionTransferResult>('/s/mailfino/transfer-selection', {
        mode,
        fieldScope,
        visibleSourceFields: fieldScope === 'displayed' ? visibleSourceFields : [],
        recordIds: mode === 'selection' ? selectedRecordIds : [],
        selectionListName: mode === 'selection' ? selectionListName : '',
      });
      setResult(response);
      setOpenUrl(readSafeOpenUrl(response.openUrl));
    } catch {
      setFailedMode(mode);
    } finally {
      setLoading(false);
    }
  };

  /** Shows an inline confirmation only when the known transfer size crosses the conservative threshold. */
  const startTransfer = (mode: MailfinoTransferMode) => {
    if (requiresLargeTransferConfirmation(mode, selectedCount, readiness?.targetRecordCount ?? 0)) {
      setConfirmationMode(mode);
      return;
    }
    void transfer(mode);
  };

  const selectionHint = selectedCount === 0
    ? text.selectedEmpty
    : selectedCount > 500
      ? text.selectedTooMany
      : text.selectedHint(selectedCount);
  const profileTargetName = readiness?.targetCategoryName || '—';

  /** Requests a short-lived pairing URL without exposing the workspace app key to this browser component. */
  const startPairing = async () => {
    setPairingFailed(false);
    try {
      const response = await new RestApiClient().post<{ pairingUrl?: string }>('/s/mailfino/pair-user', {});
      setPairingUrl(readSafeOpenUrl(response?.pairingUrl));
    } catch {
      setPairingUrl('');
      setPairingFailed(true);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#1f2937' }}>
      <h2 style={{ marginTop: 0, marginBottom: '8px' }}>{text.title}</h2>
      <p style={{ marginTop: 0, color: '#667085' }}>{text.intro}</p>

      {!hasPersonalConnection && contextLoaded && (
        <div style={{ marginBottom: '12px', padding: '12px', border: '1px solid #f79009', borderRadius: '8px', background: '#fffaeb' }}>
          <p style={{ marginTop: 0, color: '#b54708' }}>{text.personalConnectionRequired}</p>
          {!pairingUrl && <button type="button" onClick={() => void startPairing()} style={secondaryButtonStyle}>{text.pairAccount}</button>}
          {pairingUrl && <a href={pairingUrl} target="_blank" rel="noreferrer" style={openLinkStyle}>{text.pairingReady}</a>}
          {pairingFailed && <p style={{ marginBottom: 0, color: '#b42318' }}>{text.pairingFailed}</p>}
        </div>
      )}
      {hasPersonalConnection && contextLoaded && readiness?.ready !== true && <p style={{ color: '#b54708' }}>{text.notReady}</p>}
      {contextLoaded && displayedFieldsUnavailable && <p style={{ color: '#b54708' }}>{text.fieldsUnavailable}</p>}
      {readiness?.ready === true && <ReadinessCard readiness={readiness} text={text} />}

      <label style={{ display: 'block', marginBottom: '10px' }}>
        <span style={labelStyle}>{text.fields}</span>
        <select
          value={fieldScope}
          onChange={event => {
            setFieldScope(event.target.value as MailfinoTransferFieldScope);
            setConfirmationMode(null);
          }}
          disabled={!contextLoaded || loading}
          style={inputStyle}
        >
          <option value="displayed">{text.displayedFields}</option>
          <option value="name_email">{text.nameEmail}</option>
        </select>
        <span style={hintStyle}>{fieldScope === 'displayed' ? text.displayedFieldsHint : text.nameEmailHint}</span>
      </label>

      {effectiveSourceFields.length > 0 && <FieldPreview title={text.preview} fields={effectiveSourceFields} labels={visibleFieldLabels} isGerman={isGerman} />}
      {unmappedSourceFields.length > 0 && <FieldPreview title={text.unmapped} fields={unmappedSourceFields} labels={visibleFieldLabels} isGerman={isGerman} warning />}

      <label style={{ display: 'block', margin: '14px 0 10px' }}>
        <span style={labelStyle}>{text.selectionListName}</span>
        <input
          type="text"
          value={selectionListName}
          maxLength={100}
          placeholder={text.selectionListPlaceholder}
          disabled={loading}
          onChange={event => {
            setSelectionListName(event.target.value);
            setConfirmationMode(null);
          }}
          style={inputStyle}
        />
      </label>

      <ActionButton disabled={transferDisabled} label={text.all} hint={text.allHint(profileTargetName, readiness?.targetRecordCount ?? 0)} onClick={() => startTransfer('all')} />
      <ActionButton disabled={selectionDisabled} label={text.selected} hint={selectionHint} onClick={() => startTransfer('selection')} />

      {confirmationMode && (
        <ConfirmationCard
          title={text.confirmTitle}
          message={confirmationMode === 'selection'
            ? text.confirmSelection(selectedCount, effectiveSourceFields.length)
            : text.confirmAll(readiness?.targetRecordCount ?? 0, effectiveSourceFields.length)}
          confirmLabel={text.confirm}
          cancelLabel={text.cancel}
          onConfirm={() => void transfer(confirmationMode)}
          onCancel={() => setConfirmationMode(null)}
        />
      )}

      {loading && <p style={{ color: '#667085' }}>{text.loading}</p>}
      {failedMode && (
        <div style={{ marginTop: '12px', color: '#b42318' }}>
          <p>{text.error}</p>
          <button type="button" onClick={() => void transfer(failedMode)} style={secondaryButtonStyle}>{text.retry}</button>
        </div>
      )}
      {result && <ResultCard result={result} text={text} />}

      {openUrl && (
        <a href={openUrl} target="_blank" rel="noreferrer" style={openLinkStyle}>
          {result ? text.openList : text.open}
        </a>
      )}
    </div>
  );
};

/** Applies the explicit UX thresholds without starting a network request. */
export function requiresLargeTransferConfirmation(mode: MailfinoTransferMode, selectedCount: number, targetRecordCount: number): boolean {
  return mode === 'selection' ? selectedCount >= largeSelectionThreshold : targetRecordCount >= largeProfileThreshold;
}

/** Intersects the current view with the saved mapping and mirrors the backend's mandatory e-mail behavior. */
export function resolveEffectiveSourceFields(
  fieldScope: MailfinoTransferFieldScope,
  visibleSourceFields: string[],
  mappedSourceFields: Set<string>,
  emailSourceField: string,
): string[] {
  const candidates = fieldScope === 'name_email'
    ? ['name.firstName', 'name.lastName', emailSourceField]
    : [...visibleSourceFields, emailSourceField];
  return [...new Set(candidates.filter(field => field && mappedSourceFields.has(field)))];
}

/** Renders a readable metadata-only preview without exposing any contact values. */
const FieldPreview = ({ title, fields, labels, isGerman, warning = false }: {
  title: string;
  fields: string[];
  labels: Record<string, string>;
  isGerman: boolean;
  warning?: boolean;
}) => (
  <div style={{ marginBottom: '8px', padding: '9px 11px', borderRadius: '7px', background: warning ? '#fffaeb' : '#f2f4f7', color: warning ? '#93370d' : '#344054' }}>
    <strong style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>{title}</strong>
    <span style={{ fontSize: '12px', lineHeight: 1.45 }}>{fields.map(field => readableFieldLabel(field, labels[field], isGerman)).join(', ')}</span>
  </div>
);

/** Converts common Twenty compound paths into familiar labels and retains metadata labels for custom fields. */
export function readableFieldLabel(sourceField: string, metadataLabel: string | undefined, isGerman: boolean): string {
  const labels: Record<string, [string, string]> = {
    'name.firstName': ['Vorname', 'First name'],
    'name.lastName': ['Nachname', 'Last name'],
    'emails.primaryEmail': ['E-Mail', 'E-mail'],
    'phones.primaryPhoneNumber': ['Telefon', 'Phone'],
    'phones.primaryPhoneCountryCode': ['Telefon-Ländercode', 'Phone country code'],
    companyName: ['Firma', 'Company'],
  };
  const known = labels[sourceField];
  return known ? known[isGerman ? 0 : 1] : metadataLabel?.trim() || sourceField;
}

/** Renders one chooser row with a concise consequence description. */
const ActionButton = ({ disabled, label, hint, onClick }: { disabled: boolean; label: string; hint: string; onClick: () => void }) => (
  <button type="button" disabled={disabled} onClick={onClick} style={{
    display: 'block', width: '100%', textAlign: 'left', marginBottom: '10px', padding: '12px 14px',
    border: '1px solid #d0d5dd', borderRadius: '8px', background: disabled ? '#f2f4f7' : '#fff',
    color: disabled ? '#98a2b3' : '#1f2937', cursor: disabled ? 'default' : 'pointer',
  }}>
    <span style={{ display: 'block', fontWeight: 600, marginBottom: '3px' }}>{label}</span>
    <span style={{ display: 'block', fontSize: '12px' }}>{hint}</span>
  </button>
);

/** Renders a non-native inline confirmation so large transfers retain Twenty side-panel context. */
const ConfirmationCard = ({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div style={{ margin: '12px 0', padding: '12px', border: '1px solid #f79009', borderRadius: '8px', background: '#fffaeb' }}>
    <strong style={{ display: 'block', marginBottom: '4px' }}>{title}</strong>
    <span style={{ display: 'block', marginBottom: '10px', fontSize: '12px' }}>{message}</span>
    <button type="button" onClick={onConfirm} style={{ ...secondaryButtonStyle, marginRight: '8px', background: '#b54708', color: '#fff' }}>{confirmLabel}</button>
    <button type="button" onClick={onCancel} style={secondaryButtonStyle}>{cancelLabel}</button>
  </div>
);

/** Renders the account-bound import readiness returned by mailfino without exposing contact values. */
const ReadinessCard = ({ readiness, text }: { readiness: MailfinoTransferReadiness; text: typeof copy.de }) => (
  <div style={{ marginBottom: '12px', padding: '12px 14px', border: '1px solid #a6f4c5', borderRadius: '8px', background: '#ecfdf3' }}>
    <strong style={{ display: 'block', marginBottom: '8px', color: '#067647' }}>✓ {text.ready}</strong>
    <ReadinessRow label={text.account} value={readiness.account} />
    <ReadinessRow label={text.profile} value={readiness.importProfileName} />
    <ReadinessRow label={text.profileTarget} value={readiness.targetCategoryName} />
    <ReadinessRow label={text.email} value={readiness.emailSourceField} />
    <ReadinessRow label={text.personalization} value={String(readiness.personalizationFieldCount)} />
  </div>
);

/** Renders the result counters returned by the existing recipient import and sync runtimes. */
const ResultCard = ({ result, text }: { result: MailfinoSelectionTransferResult; text: typeof copy.de }) => {
  const rows: Array<[string, number]> = [
    [text.transferred, result.transferredCount], [text.created, result.createdCount], [text.updated, result.updatedCount],
    [text.unchanged, result.unchangedCount], [text.skipped, result.skippedCount], [text.failed, result.failedCount],
    [text.duplicates, result.duplicateCount],
  ];
  return (
    <div style={{ marginTop: '12px', padding: '12px 14px', border: '1px solid #a6f4c5', borderRadius: '8px', background: '#ecfdf3', color: '#067647' }}>
      <strong style={{ display: 'block', marginBottom: '5px' }}>{text.result}</strong>
      <span style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>{text.success(result.transferredCount, result.listName)}</span>
      {rows.filter(([, value], index) => index === 0 || value > 0).map(([label, value]) => <ReadinessRow key={label} label={label} value={String(value)} />)}
    </div>
  );
};

/** Renders one compact label/value pair inside status cards. */
const ReadinessRow = ({ label, value }: { label: string; value: string }) => (
  <span style={{ display: 'block', fontSize: '12px', lineHeight: 1.5 }}><span style={{ fontWeight: 600 }}>{label}:</span> {value || '—'}</span>
);

const labelStyle = { display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 600 };
const hintStyle = { display: 'block', marginTop: '5px', color: '#667085', fontSize: '12px', lineHeight: 1.4 };
const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '10px 12px', border: '1px solid #d0d5dd', borderRadius: '7px', background: '#fff' };
const secondaryButtonStyle = { padding: '8px 11px', border: '1px solid #d0d5dd', borderRadius: '6px', background: '#fff', cursor: 'pointer' };
const openLinkStyle = { display: 'inline-block', marginTop: '8px', padding: '10px 14px', borderRadius: '6px', background: '#1961ed', color: '#fff', textDecoration: 'none', fontWeight: 600 };

/** Accepts only a credential-free HTTP(S) launch URL returned by trusted app server logic. */
function readSafeOpenUrl(value: unknown): string {
  try {
    const url = new URL(typeof value === 'string' ? value : '');
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : '';
  } catch {
    return '';
  }
}

export default defineFrontComponent({
  universalIdentifier: TRANSFER_CHOOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'transfer-chooser',
  description: 'Chooses whether all or selected Twenty People are transferred to mailfino.',
  component: TransferChooser,
});
