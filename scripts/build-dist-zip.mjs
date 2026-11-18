import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';

const distPath = path.resolve('dist');
const publicPath = path.resolve('public');
const targetZipInPublic = path.join(publicPath, 'dist.zip');
const targetZipInDist = path.join(distPath, 'dist.zip');

const skipBuild = process.argv.includes('--no-build');
const distExists = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, 'index.html'));

if (!skipBuild || !distExists) {
  console.log('--- Building Vite Production Bundle ---');
  execSync('npx vite build', { stdio: 'inherit' });
}

if (!fs.existsSync(distPath)) {
  console.error('Error: dist folder was not generated.');
  process.exit(1);
}

console.log('--- Creating InfinityFree Production ZIP ---');
const zip = new AdmZip();

// Recursively add files from dist, skipping server.cjs and dist.zip
function addFolderToZip(folderPath, zipSubfolder = '') {
  const items = fs.readdirSync(folderPath);
  for (const item of items) {
    if (item.startsWith('server.cjs') || item === 'dist.zip' || item.endsWith('.map')) {
      continue;
    }
    const fullPath = path.join(folderPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      addFolderToZip(fullPath, zipSubfolder ? `${zipSubfolder}/${item}` : item);
    } else {
      const entryPath = zipSubfolder ? `${zipSubfolder}/${item}` : item;
      const fileData = fs.readFileSync(fullPath);
      zip.addFile(entryPath, fileData);
    }
  }
}

addFolderToZip(distPath);

// Make sure .htaccess is included for InfinityFree Apache URL rewriting
const htaccessPath = path.join(publicPath, '.htaccess');
if (fs.existsSync(htaccessPath) && !zip.getEntry('.htaccess')) {
  zip.addFile('.htaccess', fs.readFileSync(htaccessPath));
  console.log(' + Force-added: .htaccess');
}

// Ensure PHP helper scripts are in zip if present
const phpFiles = ['cron.php', 'proxy.php', 'telegram-post.php', 'scrape-blogger.php', 'adsterra-stats.php'];
for (const file of phpFiles) {
  const filePath = path.join(publicPath, file);
  if (fs.existsSync(filePath) && !zip.getEntry(file)) {
    zip.addFile(file, fs.readFileSync(filePath));
    console.log(` + Force-added: ${file}`);
  }
}

// Write to public/dist.zip
fs.writeFileSync(targetZipInPublic, zip.toBuffer());
console.log(`\nSuccessfully created: ${targetZipInPublic} (${(fs.statSync(targetZipInPublic).size / (1024 * 1024)).toFixed(2)} MB)`);

// Also copy to dist/dist.zip and ./dist.zip for immediate web serving & download
try {
  fs.copyFileSync(targetZipInPublic, targetZipInDist);
  console.log(`Copied to: ${targetZipInDist}`);
} catch (e) {
  // dist folder might not exist yet in some edge cases
}

try {
  const rootZip = path.resolve('dist.zip');
  fs.copyFileSync(targetZipInPublic, rootZip);
  console.log(`Copied to: ${rootZip}`);
} catch (e) {
  // ignore
}

