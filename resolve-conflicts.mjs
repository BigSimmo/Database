
import fs from "fs";
import { execSync } from "child_process";

const files = execSync("git grep -l \"<<<<<<< HEAD\"", { encoding: "utf8" }).trim().split("\n");

for (const file of files) {
  if (!file) continue;
  let content = fs.readFileSync(file, "utf8");
  // Replace the conflict markers
  const regex = /<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> [^\n]*\n/g;
  content = content.replace(regex, "$1");
  fs.writeFileSync(file, content);
  console.log(`Resolved ${file}`);
}

