import { downloadCatalog } from '../catalog.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const images = fileURLToPath(new URL('../dist/assets/champions/',import.meta.url));
const catalog = await downloadCatalog(images,'/assets/champions');
await writeFile(new URL('../dist/catalog.json',import.meta.url),JSON.stringify(catalog,null,2));
console.log(`Bundled ${catalog.champions.length} champions and portraits, Data Dragon ${catalog.version}.`);
