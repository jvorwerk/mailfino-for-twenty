# mailfino for Twenty

Transfer People from Twenty to mailfino without exporting contact data through the browser.
The app reuses the Twenty connection, import profile, filters, and field mapping already configured
in mailfino.

## What the app does

Select People in Twenty and run **Transfer to mailfino**. Before enabling either transfer action,
the chooser verifies the assigned mailfino account, enabled Twenty People import profile, required
e-mail source field, and number of mapped personalization fields. One dropdown applies to both
transfer actions:

- **Transfer displayed fields** intersects the columns of the current Twenty People view with the
  mapping stored in mailfino. Compound name and e-mail columns are expanded automatically; the
  configured e-mail field is always included.
- **Transfer name and e-mail only** limits the transfer to first name, last name, and the configured
  primary e-mail field.

The chooser previews the fields that will actually be transferred and separately lists displayed
Twenty fields that have no mailfino mapping. The last successful field mode is remembered for the
individual Twenty user.

The chooser then offers:

- **Transfer all from import profile** runs the enabled Twenty People import profile, including its
  saved source filter, and shows the linked destination list before starting.
- **Transfer selected** transfers between 1 and 500 selected People into a new static list. The user
  may enter its name or leave the field empty for a collision-resistant generated name.
- **Open mailfino** opens the connected mailfino application without transferring data. After a
  successful transfer, the link opens the exact created or updated recipient list.

Both transfer modes use the same selected field scope and the existing mapping stored in mailfino.
Known large transfers require an inline confirmation. After completion, the chooser shows created,
updated, unchanged, skipped, failed, and duplicate counters provided by the existing import runtime.
Failures retain the current selection, field mode, and list name for one-click retry.
The app does not create newsletters, open an editor, or send messages.

## Install from the Twenty Marketplace

Once the package has been published, open **Settings → Applications** in Twenty, find
**mailfino**, and select **Install**. Twenty 2.34.0 or newer is required.

A mailfino administrator performs the workspace setup once:

1. Open the existing Twenty connection in mailfino's connection manager.
2. In **Twenty Marketplace app**, create an app key and copy the displayed mailfino URL and key.
3. Open the installed app's settings in Twenty. Set `MAILFINO_BASE_URL` to that URL and
   `MAILFINO_APP_KEY` to the copied key.

`MAILFINO_BASE_URL` defaults to `https://app.mailfino.de`, but each Twenty workspace can point the
same Marketplace package at its own self-hosted mailfino installation. The secret is scoped to the
installed app in that workspace and is available only to its server-side logic functions.

The first time a Twenty user opens the transfer chooser, they select **Assign mailfino account** and
sign in to the mailfino main account or direct subaccount they should use. mailfino consumes the
short-lived pairing link once and stores only the mapping between the existing connection, the
server-derived Twenty user ID, and that mailfino account. No extra CRM connection is created.

## Required mailfino configuration

The connected mailfino account needs exactly one enabled Twenty connection and one enabled People
import profile for the same Twenty origin. The import profile controls:

- the source and filter used by **Transfer all**;
- the required e-mail field;
- optional personalization fields such as first name, last name, company, and custom fields;
- the linked recipient list used by the normal synchronization.

## Permissions and data handling

The app follows a narrow key and data-access contract:

- one random app key per existing mailfino Twenty connection, stored only as a SHA-256 hash in mailfino;
- one mailfino main-account or direct-subaccount assignment per Twenty user;
- read-only access to Twenty People;
- no contact values or Twenty API credentials sent from the browser to mailfino;
- only the chosen mode and field scope, safe field identifiers, an optional bounded static-list name,
  selected Person IDs when needed, and the trusted Twenty origin are relayed;
- selected IDs are retained in user-scoped Twenty app storage for at most ten minutes while the
  chooser opens; the active view ID is retained with them so the chooser can load its columns through
  Twenty's authenticated metadata API. Both are removed after a successful transfer;
- app requests bind the key to the saved Twenty origin and to the user ID supplied by Twenty's
  authenticated server-side route;
- pairing codes expire after ten minutes and can be used only once;
- mailfino launch links use a separate one-minute, single-use login token for the assigned account.

mailfino retrieves contact values through the existing server-side Twenty connection and applies the
configured import profile. The returned launch URL contains only the numeric recipient-list ID and no
contact or other personal data.

## Support and legal information

- Website: https://www.mailfino.de/
- Support: https://mynewsletterrocks.freshdesk.com/support/tickets/new
- Terms: https://www.mailfino.de/agb/
- Privacy: https://www.mailfino.de/datenschutz/

## Development

Install dependencies and run the local checks:

```bash
corepack yarn install --immutable
corepack yarn typecheck
corepack yarn test
```

A production Marketplace artifact is built and checked with:

```bash
corepack yarn marketplace:build
```

The same artifact supports Cloud and self-hosted installations because the mailfino URL and app key
are application variables configured independently for each installed Twenty workspace. Plain HTTP
URLs are accepted only for `localhost`, `127.0.0.1`, and `host.docker.internal` development fixtures.

The private end-to-end fixture is documented in `tests/integration/twenty-oauth/README.md`. It verifies
consent denial and approval, refresh-token rotation, readiness and field preview, both transfer
modes, both field scopes, custom static-list naming, result counters, the exact recipient-list
hand-off, and complete revocation without mutating a shared mailfino database.
