import { MAILFINO_PUBLIC_CLOUD_ORIGIN } from 'src/constants';

const LOCAL_DEVELOPMENT_HOSTS = new Set(['127.0.0.1', 'localhost', 'host.docker.internal']);

/**
 * Normalizes one configured mailfino origin before it is embedded in the app manifest
 * or used by a Twenty logic function. Called by the provider and on-connect handler.
 */
export function normalizeMailfinoBaseUrl(rawValue: string | undefined, settingName: string): string {
  if (!rawValue?.trim()) throw new Error(`${settingName} is required.`);

  const url = new URL(rawValue.trim());
  if (url.username || url.password || url.search || url.hash)
    throw new Error(`${settingName} must be an origin without credentials, query, or fragment.`);
  if (url.pathname !== '/' && url.pathname !== '')
    throw new Error(`${settingName} must not contain a path.`);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_DEVELOPMENT_HOSTS.has(url.hostname)))
    throw new Error(`${settingName} must use HTTPS outside local development.`);

  return url.origin;
}

/** Uses mailfino Cloud as the editable per-workspace default while allowing self-hosted installations. */
export function resolveMailfinoApiBaseUrl(rawValue: string | undefined): string {
  return normalizeMailfinoBaseUrl(rawValue ?? MAILFINO_PUBLIC_CLOUD_ORIGIN, 'MAILFINO_BASE_URL');
}

/** Returns one absolute mailfino endpoint without inheriting a configured path. */
export function mailfinoEndpoint(baseUrl: string, path: string): string {
  return new URL(path, `${baseUrl}/`).toString();
}
