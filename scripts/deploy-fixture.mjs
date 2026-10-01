import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { appDeploy } from 'twenty-sdk/cli';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(appDirectory, '../..');
const applicationUniversalIdentifier = '3f413f75-62d1-4aa5-a6ca-524e835378b5';

/** Reads a dotenv file as data so fixture secrets are never evaluated as shell input. */
function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const entries = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    });
  return Object.fromEntries(entries);
}

/** Returns one mandatory fixture setting without including its value in errors. */
function requireSetting(settings, name) {
  const value = settings[name]?.trim();
  if (!value) throw new Error(`Set ${name} before deploying the fixture app.`);
  return value;
}

/** Calls Twenty's supported metadata API and emits only sanitized GraphQL failures. */
async function metadataRequest(baseUrl, apiKey, query, variables) {
  const response = await fetch(`${baseUrl}/metadata`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    const messages = payload.errors?.map(error => error.message).filter(Boolean).join('; ');
    throw new Error(messages || `Twenty metadata request failed with HTTP ${response.status}.`);
  }
  return payload.data;
}

/** Resolves the package-versioned tarball produced by `yarn build`. */
function resolveTarball() {
  if (process.argv[2]) return path.resolve(process.cwd(), process.argv[2]);
  const packageJson = JSON.parse(fs.readFileSync(path.join(appDirectory, 'package.json'), 'utf8'));
  return path.join(
    appDirectory,
    '.twenty/output',
    `mailfino-twenty-connector-${packageJson.version}.tgz`,
  );
}

/** Reuses an installed app during browser-only retries or installs a newly uploaded registration. */
async function resolveApplication(baseUrl, apiKey, reuseCurrent) {
  if (reuseCurrent) {
    const current = await metadataRequest(baseUrl, apiKey, `
      query CurrentMailfinoApplication($universalIdentifier: UUID!) {
        findOneApplication(universalIdentifier: $universalIdentifier) {
          id
          version
          applicationRegistrationId
        }
      }
    `, { universalIdentifier: applicationUniversalIdentifier });
    return current.findOneApplication;
  }

  const data = await metadataRequest(baseUrl, apiKey, `
    mutation InstallMailfinoApplication($universalIdentifier: String!) {
      installApplication(universalIdentifier: $universalIdentifier) {
        id
        version
        applicationRegistrationId
      }
    }
  `, { universalIdentifier: applicationUniversalIdentifier });
  return data.installApplication;
}

const rootSettings = readDotEnv(path.join(repositoryRoot, '.env.local'));
const settings = { ...rootSettings, ...process.env };
const twentyBaseUrl = requireSetting(settings, 'MNR_E2E_TWENTYCRM_BASE_URL').replace(/\/+$/, '');
const twentyApiKey = requireSetting(settings, 'MNR_E2E_TWENTYCRM_API_KEY');
const tarballPath = resolveTarball();
if (!fs.existsSync(tarballPath)) throw new Error(`Build the app tarball first: ${tarballPath}`);

const reuseCurrent = settings.MNR_E2E_TWENTY_APP_REUSE === 'true';
if (!reuseCurrent) {
  const deployment = await appDeploy({
    tarballPath,
    serverUrl: twentyBaseUrl,
    token: twentyApiKey,
  });
  if (!deployment.success) throw new Error(deployment.error.message);
}
const application = await resolveApplication(twentyBaseUrl, twentyApiKey, reuseCurrent);

console.log(JSON.stringify({
  deployed: !reuseCurrent,
  reused: reuseCurrent,
  installed: true,
  configured: false,
  nextStep: 'Set MAILFINO_BASE_URL and MAILFINO_APP_KEY in the installed app workspace settings.',
  version: application.version,
}));
