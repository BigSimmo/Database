import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dirs = ['public/mockups', 'public/demo-documents'];

async function optimizeImages() {
  for (const dir of dirs) {
    const fullDir = path.join(rootDir, dir);
    let files;
    try {
      files = await fs.readdir(fullDir);
    } catch (err) {
      continue;
    }
    
    for (const file of files) {
      if (file.endsWith('.png')) {
        const filePath = path.join(fullDir, file);
        const name = path.basename(file, '.png');
        
        await sharp(filePath)
          .webp({ quality: 80 })
          .toFile(path.join(fullDir, `${name}.webp`));
          
        await sharp(filePath)
          .avif({ quality: 80 })
          .toFile(path.join(fullDir, `${name}.avif`));
          
        console.log(`Optimized ${file} to .webp and .avif`);
      }
    }
  }
}

optimizeImages().catch(console.error);
