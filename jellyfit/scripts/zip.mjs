/**
 * Zips a build folder for upload (no external binaries).
 *   node scripts/zip.mjs                                   dist/ → jellyfit.zip
 *   node scripts/zip.mjs dist-crazygames jellyfit-crazygames.zip
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = process.argv[2] || 'dist';
const outName = process.argv[3] || 'jellyfit.zip';
if (!existsSync(join(root, 'index.html'))) {
  console.error(`Run the build first (${root}/index.html is missing)`);
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(root);
const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(root, file).split('\\').join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0);
  head.writeUInt16LE(20, 4);
  head.writeUInt16LE(0, 6);
  head.writeUInt16LE(8, 8);
  head.writeUInt32LE(0, 10);
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(comp.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26);
  head.writeUInt16LE(0, 28);
  local.push(head, name, comp);
  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0, 8);
  cen.writeUInt16LE(8, 10);
  cen.writeUInt32LE(0, 12);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(comp.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(name.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, name);
  offset += head.length + name.length + comp.length;
}
const cenSize = central.reduce((a, b) => a + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenSize, 12);
end.writeUInt32LE(offset, 16);
const out = Buffer.concat([...local, ...central, end]);
writeFileSync(outName, out);
console.log(`${outName}: ${files.length} files, ${(out.length / 1024).toFixed(1)} KB`);
