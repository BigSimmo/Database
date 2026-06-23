import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const paths = [
  'C:\\Users\\joshs\\OneDrive\\Medicine\\Guidelines\\NMHS',
  'C:\\Users\\joshs\\OneDrive\\Medicine\\Guidelines\\PHC',
  'C:\\Users\\joshs\\OneDrive\\Medicine\\Guidelines\\RKPG',
  'C:\\Users\\joshs\\OneDrive\\Medicine\\Guidelines\\SMHS'
];

const extensions = [".pdf", ".docx", ".xlsx", ".txt"];

async function countFiles(dir: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;

  async function visit(current: string) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          count++;
          try {
            const s = await stat(fullPath);
            bytes += s.size;
          } catch {}
        }
      }
    }
  }

  await visit(dir);
  return { count, bytes };
}

async function main() {
  let grandTotalCount = 0;
  let grandTotalBytes = 0;
  for (const dir of paths) {
    const { count, bytes } = await countFiles(dir);
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    console.log(`${dir}: ${count} files (${mb} MB)`);
    grandTotalCount += count;
    grandTotalBytes += bytes;
  }
  const grandTotalMB = (grandTotalBytes / (1024 * 1024)).toFixed(2);
  console.log(`Grand Total: ${grandTotalCount} files (${grandTotalMB} MB)`);
}

main().catch(console.error);
