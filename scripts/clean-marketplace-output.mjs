import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(appDirectory, '.twenty', 'output');

/** Removes only Twenty's generated output so a production build cannot reuse fixture metadata. */
function cleanMarketplaceOutput() {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
}

cleanMarketplaceOutput();
