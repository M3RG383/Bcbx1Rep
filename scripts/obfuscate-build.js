const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const CHUNKS_DIR = path.join(__dirname, "..", ".next", "static", "chunks");

function obfuscateFile(filePath) {
  if (!filePath.endsWith(".js")) return;
  const code = fs.readFileSync(filePath, "utf8");
  // Skip already small files (maps, webpack bootstrap)
  if (code.length < 500) return;
  
  const result = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: false, // Don't break the site
    disableConsoleOutput: false, // Don't kill console.log
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ["rc4"],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  });

  fs.writeFileSync(filePath, result.getObfuscatedCode());
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(fullPath);
    else obfuscateFile(fullPath);
  }
}

console.log("🔒 Obfuscating build output...");
walkDir(CHUNKS_DIR);
console.log("✅ Obfuscation complete");