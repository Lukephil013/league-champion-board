import { mkdir, writeFile, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
const CDN = 'https://ddragon.leagueoflegends.com';
async function get(url, binary = false) {
  const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`Champion data request failed (${r.status}).`);
  return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
}
export async function downloadCatalog(destination, imagePrefix) {
  const versions = await get(`${CDN}/api/versions.json`);
  const version = versions[0];
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid roster version.');
  const raw = await get(`${CDN}/cdn/${version}/data/en_US/champion.json`);
  const champions = Object.values(raw.data).map(c => {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(c.id) || typeof c.name !== 'string' || !/^[A-Za-z0-9]+\.png$/.test(c.image.full)) throw new Error('Invalid champion record.');
    return { id:c.id, name:c.name, title:c.title, image:`${imagePrefix}/${c.id}.png`, filename:c.image.full };
  }).sort((a,b) => a.name.localeCompare(b.name));
  if (champions.length < 100) throw new Error('Roster download was incomplete.');
  await mkdir(destination, { recursive:true });
  let cursor = 0;
  await Promise.all(Array.from({length:6}, async () => {
    while (cursor < champions.length) {
      const c = champions[cursor++];
      const image = await get(`${CDN}/cdn/${version}/img/champion/${c.filename}`, true);
      if (!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Invalid champion portrait.');
      await writeFile(path.join(destination, `${c.id}.png`), image);
    }
  }));
  return { version, champions:champions.map(({ filename,...c })=>c) };
}
export async function activeCatalog(root) {
  try { return JSON.parse(await readFile(path.join(root,'.catalog-cache','active.json'),'utf8')); }
  catch { return JSON.parse(await readFile(path.join(root,'dist','catalog.json'),'utf8')); }
}
export async function refreshCatalog(root) {
  const generation = `${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
  const base = path.join(root,'.catalog-cache');
  const catalog = await downloadCatalog(path.join(base,generation), `/catalog/${generation}`);
  const temp = path.join(base,`active-${generation}.json`);
  await writeFile(temp,JSON.stringify(catalog));
  await rename(temp,path.join(base,'active.json'));
  return catalog;
}
