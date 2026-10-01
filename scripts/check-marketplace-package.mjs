import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(appDirectory, '.twenty', 'output');

/** Reads one required JSON artifact and reports its relative path on malformed input. */
function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read ${path.relative(appDirectory, filePath)}: ${error.message}`);
  }
}

/** Rejects local fixture origins and URLs that are not suitable for a public marketplace package. */
function assertPublicHttpsUrl(value, fieldName) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', 'host.docker.internal'].includes(url.hostname))
    throw new Error(`${fieldName} must use a public HTTPS origin.`);
}

/** Reads the fixed PNG header so the Marketplace gate can enforce Twenty's recommended 8:5 gallery size. */
function readPngDimensions(filePath) {
  const header = fs.readFileSync(filePath).subarray(0, 24);
  const pngSignature = '89504e470d0a1a0a';
  if (header.length < 24 || header.subarray(0, 8).toString('hex') !== pngSignature)
    throw new Error(`The marketplace gallery asset is not a PNG: ${path.relative(appDirectory, filePath)}`);

  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

/** Validates the source package and built manifest before an npm publish is attempted. */
function checkMarketplacePackage() {
  const sourcePackage = readJson(path.join(appDirectory, 'package.json'));
  const outputPackage = readJson(path.join(outputDirectory, 'package.json'));
  const manifest = readJson(path.join(outputDirectory, 'manifest.json'));
  const application = manifest.application;

  if (sourcePackage.private === true || outputPackage.private === true)
    throw new Error('Marketplace packages must not be marked private.');
  if (!sourcePackage.keywords?.includes('twenty-app') || !outputPackage.keywords?.includes('twenty-app'))
    throw new Error('The required twenty-app npm keyword is missing.');
  if (sourcePackage.publishConfig?.access !== 'public')
    throw new Error('publishConfig.access must be public.');
  if (!sourcePackage.engines?.twenty || !sourcePackage.engines?.node)
    throw new Error('Both Twenty and Node engine ranges are required.');
  if (!sourcePackage.license)
    throw new Error('A package license is required.');
  if (fs.readdirSync(outputDirectory).some((fileName) => fileName.endsWith('.tgz')))
    throw new Error('The publish directory must not contain a nested npm tarball.');

  for (const [fieldName, value] of Object.entries({
    websiteUrl: application?.websiteUrl,
    termsUrl: application?.termsUrl,
    issueReportUrl: application?.issueReportUrl,
  })) {
    if (typeof value !== 'string' || value.length === 0)
      throw new Error(`${fieldName} is required in the marketplace manifest.`);
    assertPublicHttpsUrl(value, fieldName);
  }

  if (!application?.logo || !fs.existsSync(path.join(outputDirectory, application.logo)))
    throw new Error('The marketplace logo is missing from the built package.');
  if (!application?.aboutDescription?.trim())
    throw new Error('The marketplace description generated from README.md is missing.');
  if (!Array.isArray(application?.galleryImages) || application.galleryImages.length === 0)
    throw new Error('The marketplace gallery must contain at least one image.');
  for (const galleryImage of application.galleryImages) {
    const galleryImagePath = path.join(outputDirectory, galleryImage);
    if (!fs.existsSync(galleryImagePath))
      throw new Error(`The marketplace gallery image is missing: ${galleryImage}`);
    const dimensions = readPngDimensions(galleryImagePath);
    if (dimensions.width !== 1600 || dimensions.height !== 1000)
      throw new Error(`The marketplace gallery image must be 1600x1000: ${galleryImage}`);
  }

  if (manifest.connectionProviders?.some(({ name }) => name === 'mailfino'))
    throw new Error('The Marketplace app must not require a separate mailfino OAuth connection.');
  const mailfinoUrl = application?.applicationVariables?.MAILFINO_BASE_URL;
  const appKey = application?.applicationVariables?.MAILFINO_APP_KEY;
  if (mailfinoUrl?.value !== 'https://app.mailfino.de' || mailfinoUrl?.isSecret === true)
    throw new Error('MAILFINO_BASE_URL must default to the public cloud and remain editable per workspace.');
  if (!appKey?.isSecret || appKey?.value)
    throw new Error('MAILFINO_APP_KEY must be a workspace-scoped secret without a packaged value.');
  if (!application?.requiredServerVersionRange?.includes('2.34.0'))
    throw new Error('The marketplace manifest must require Twenty 2.34.0 or newer.');

  console.log(JSON.stringify({
    marketplacePackageReady: true,
    package: outputPackage.name,
    version: outputPackage.version,
    twenty: application.requiredServerVersionRange,
    websiteUrl: application.websiteUrl,
    galleryImages: application.galleryImages,
  }));
}

checkMarketplacePackage();
