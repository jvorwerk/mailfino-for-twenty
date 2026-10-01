import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(appDirectory, '.twenty', 'output', 'manifest.json');

/** Reads the default mailfino installation from the built per-workspace variable contract. */
function readDefaultMailfinoOrigin() {
  if (!fs.existsSync(manifestPath))
    throw new Error('Build the Marketplace package before checking its public app endpoint.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const value = manifest.application?.applicationVariables?.MAILFINO_BASE_URL?.value;
  if (typeof value !== 'string') throw new Error('The built manifest has no default MAILFINO_BASE_URL.');
  return new URL(value).origin;
}

/** Confirms that the default host exposes the app API and rejects an unauthenticated request. */
async function checkMarketplaceEndpoints() {
  const origin = readDefaultMailfinoOrigin();
  const endpoint = new URL('/api/integrations/v1/twenty/user-link', origin);
  const response = await fetch(endpoint, { redirect: 'error' });
  if (response.status !== 401)
    throw new Error(`Twenty app authentication endpoint is not ready at ${endpoint}: HTTP ${response.status}.`);
  console.log(JSON.stringify({ appEndpointReady: true, origin, endpoint: endpoint.toString() }));
}

await checkMarketplaceEndpoints();
