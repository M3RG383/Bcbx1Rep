const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const APP_DIR = path.join(__dirname, "..", "app");
const DATA_API = "https://jack0.x1.xyz:8800/api/data";

// Collect all CSS/content from app directory
let designContent = "";
function collectCSS(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith(".")) collectCSS(full);
    else if (e.name.endsWith(".css") || e.name.endsWith(".tsx") || e.name.endsWith(".jsx")) {
      const content = fs.readFileSync(full, "utf8");
      designContent += content + "\n";
    }
  }
}

collectCSS(APP_DIR);
const hash = crypto.createHash("sha256").update(designContent).digest("hex");
console.log(`📐 Design SHA256: ${hash}`);

const timestamp = new Date().toISOString();
const message = `BLOOCKCHAIN_BEATS_DESIGN_v1|${hash}|${timestamp}|M3RG3`;

// Use @solana/web3.js to craft and send the memo transaction
async function stampToX1() {
  const solanaWeb3 = require("@solana/web3.js");
  const keypairPath = "/home/jack/newtheo/workspace-cyberdyne/owl-kryptark-radio/owl-deploy-keypair.json";
  const rpcUrl = "https://rpc.mainnet.x1.xyz";

  // Load keypair
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
  const payer = solanaWeb3.Keypair.fromSecretKey(secret);
  console.log(`🔑 Payer: ${payer.publicKey.toBase58()}`);

  // Connect to X1
  const connection = new solanaWeb3.Connection(rpcUrl, "confirmed");

  // Memo program ID
  const MEMO_PROGRAM_ID = new solanaWeb3.PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  // Create memo instruction
  const memoIx = new solanaWeb3.TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(message, "utf8"),
  });

  // Build and send transaction
  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const tx = new solanaWeb3.Transaction().add(memoIx);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(payer);

  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log(`✅ Blockchain stamp sent! Signature: ${sig}`);

  // Wait for confirmation
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`✅ Transaction confirmed`);

  // Store proof in KV
  const proofData = JSON.stringify({
    hash,
    txSignature: sig,
    timestamp,
    message,
    designVersion: "1.0",
    owner: "M3RG3⚓️",
  });

  const proofPayload = JSON.stringify({
    key: "design:proof",
    value: JSON.stringify(proofData),
  });
  execSync(
    `curl -s -X POST "${DATA_API}/set" -H "Content-Type: application/json" -d '${proofPayload.replace(/'/g, "'\\''")}'`,
    { timeout: 10000 }
  );

  console.log(`💾 Proof stored in KV`);
  console.log(`🔗 Explorer: https://explorer.x1.xyz/tx/${sig}`);

  return sig;
}

stampToX1().catch((e) => {
  console.error("❌ Stamp failed:", e.message);
  console.log("⚠️  Storing proof without blockchain tx...");

  const proofData = JSON.stringify({
    hash,
    txSignature: null,
    timestamp,
    message,
    designVersion: "1.0",
    owner: "M3RG3⚓️",
  });

  try {
    const proofPayload = JSON.stringify({
      key: "design:proof",
      value: JSON.stringify(proofData),
    });
    execSync(
      `curl -s -X POST "${DATA_API}/set" -H "Content-Type: application/json" -d '${proofPayload.replace(/'/g, "'\\''")}'`,
      { timeout: 10000 }
    );
    console.log(`💾 Proof stored in KV (offline mode)`);
  } catch (curlErr) {
    console.error("⚠️  Could not store proof in KV:", curlErr.message);
  }
});