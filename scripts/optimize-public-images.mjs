import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const DIRECTORIES = ["public/mockups", "public/demo-documents"];

async function walkDir(dir) {
  let results = [];
  try {
    const list = await fs.readdir(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(await walkDir(filePath));
      } else {
        if (filePath.toLowerCase().endsWith(".png")) {
          results.push(filePath);
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`Error reading directory ${dir}:`, err);
    }
  }
  return results;
}

async function optimizeImages() {
  console.log("Optimizing public images to WebP and AVIF...");
  
  let totalFiles = 0;
  for (const dir of DIRECTORIES) {
    const pngFiles = await walkDir(dir);
    
    for (const file of pngFiles) {
      const ext = path.extname(file);
      const base = file.slice(0, -ext.length);
      const webpPath = `${base}.webp`;
      const avifPath = `${base}.avif`;
      
      try {
        await sharp(file).webp({ quality: 80 }).toFile(webpPath);
        await sharp(file).avif({ quality: 80 }).toFile(avifPath);
        totalFiles++;
        console.log(`Optimized: ${file}`);
      } catch (err) {
        console.error(`Failed to optimize ${file}:`, err);
      }
    }
  }
  console.log(`Successfully generated variants for ${totalFiles} images.`);
}

optimizeImages().catch((err) => {
  console.error("Image optimization failed:", err);
  process.exit(1);
});
