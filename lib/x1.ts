import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

// X1 Mainnet RPC
export const X1_RPC = "https://rpc.mainnet.x1.xyz";

// Treasury wallet — all upload/subscription fees go here
export const TREASURY_ADDRESS = "ApJ8Xnp8sFutG4i3pnsfe2C7LxArGJCzeUQpaBdvxhA7";

// Lazy-initialize PublicKey — avoids crash if Buffer polyfill isn't ready at module load time
let _treasuryPubkey: PublicKey | null = null;
export function getTreasuryPubkey(): PublicKey {
  if (!_treasuryPubkey) {
    _treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
  }
  return _treasuryPubkey;
}

// Fee constants in XNT (lamports = 10^9 on Solana/X1)
export const UPLOAD_FEE_XNT = 1.5; // XNT
export const MONTHLY_SUB_XNT = 8; // XNT
export const YEARLY_SUB_XNT = 62; // XNT

export const UPLOAD_FEE_LAMPORTS = Math.round(UPLOAD_FEE_XNT * LAMPORTS_PER_SOL);
export const MONTHLY_SUB_LAMPORTS = Math.round(MONTHLY_SUB_XNT * LAMPORTS_PER_SOL);
export const YEARLY_SUB_LAMPORTS = Math.round(YEARLY_SUB_XNT * LAMPORTS_PER_SOL);

// Purchase split: 80% to artist, 20% to treasury
export const PURCHASE_ARTIST_SHARE = 0.80;
export const PURCHASE_TREASURY_SHARE = 0.20;

// Create a connection to X1
export function getX1Connection(): Connection {
  return new Connection(X1_RPC, "confirmed");
}

/**
 * Build a SystemProgram.transfer transaction to send XNT to treasury.
 * Returns the serialized transaction (before signing).
 */
export async function buildTransferTx(fromPubKey: PublicKey, amountLamports: number): Promise<Transaction> {
  return buildTransferTxTo(fromPubKey, getTreasuryPubkey(), amountLamports);
}

/**
 * Build a SystemProgram.transfer transaction to any recipient.
 */
export async function buildTransferTxTo(
  fromPubKey: PublicKey,
  toPubKey: PublicKey,
  amountLamports: number
): Promise<Transaction> {
  const connection = getX1Connection();
  const { blockhash } = await connection.getLatestBlockhash();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromPubKey,
      toPubkey: toPubKey,
      lamports: amountLamports,
    })
  );

  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubKey;
  return tx;
}

/**
 * Verify a transaction on X1 mainnet.
 * Checks that it's a confirmed transfer to the treasury wallet
 * of at least the expected amount.
 */
export async function verifyXntTransfer(
  txSignature: string,
  expectedLamports: number,
  senderWallet: string
): Promise<{ verified: boolean; message: string }> {
  return verifyXntTransferTo(txSignature, expectedLamports, senderWallet, TREASURY_ADDRESS);
}

/**
 * Verify a transaction on X1 mainnet to a specific recipient.
 * Checks that it's a confirmed transfer to `recipientWallet`
 * of at least the expected amount.
 */
export async function verifyXntTransferTo(
  txSignature: string,
  expectedLamports: number,
  senderWallet: string,
  recipientWallet: string
): Promise<{ verified: boolean; message: string }> {
  // Retry up to 8 times with backoff — tx may not be indexed yet
  const MAX_RETRIES = 8;
  const BASE_DELAY = 500; // ms

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BASE_DELAY * Math.pow(1.5, attempt)));
    }

    try {
      // Use raw RPC with jsonParsed encoding to get structured instruction data
      const response = await fetch("https://rpc.mainnet.x1.xyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "x1-verify-" + txSignature.slice(0, 8),
          method: "getTransaction",
          params: [
            txSignature,
            { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" },
          ],
        }),
      });

      // Handle RPC errors in the HTTP layer
      if (!response.ok) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: `RPC error: ${response.status}` };
      }

      const data = await response.json();

      // Handle JSON-RPC level errors
      if (data.error) {
        // -32009 = signature not found yet (still propagating)
        if (data.error?.code === -32009 && attempt < MAX_RETRIES - 1) continue;
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: `RPC: ${data.error?.message || "unknown error"}` };
      }

      const tx = data?.result;

      if (!tx) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: "Transaction not found on-chain" };
      }

      // Safe check for meta (defensive — some edge cases return partial data)
      const meta = tx.meta;
      if (!meta) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: "Transaction metadata not available" };
      }

      if (meta.err) {
        return { verified: false, message: "Transaction failed on-chain" };
      }

      const instructions = tx.transaction?.message?.instructions || [];
      const accountKeys = (tx.transaction?.message?.accountKeys || []).map(
        (a: any) => (typeof a === "string" ? a : a?.pubkey)
      );

      const recipientPubkey = new PublicKey(recipientWallet).toBase58();
      const senderPubkey = new PublicKey(senderWallet).toBase58();

      // Scan parsed instructions for SystemProgram transfer from sender to recipient
      for (const ix of instructions) {
        const program = ix.programId || ix.program || "";
        const isSystem = program === "11111111111111111111111111111111";
        if (!isSystem) continue;

        const parsed = ix.parsed;
        if (!parsed || parsed.type !== "transfer") continue;

        const info = parsed.info || {};
        const source = info.source || "";
        const destination = info.destination || "";
        const lamports = parseInt(String(info.lamports || "0"), 10);

        // Check this is a transfer from the buyer to the artist
        if (source !== senderPubkey) continue;
        if (destination !== recipientPubkey) continue;

        if (lamports < expectedLamports) {
          return {
            verified: false,
            message: `Expected ${(expectedLamports / LAMPORTS_PER_SOL).toFixed(4)} XNT, sent ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} XNT`,
          };
        }

        return { verified: true, message: "Transaction verified on-chain" };
      }

      // Fallback: balance delta
      if (meta.preBalances && meta.postBalances) {
        const recipientIdx = accountKeys.indexOf(recipientPubkey);
        if (recipientIdx >= 0) {
          const preBal = Number(meta.preBalances[recipientIdx]) || 0;
          const postBal = Number(meta.postBalances[recipientIdx]) || 0;
          const received = postBal - preBal;
          if (received >= expectedLamports) {
            return { verified: true, message: "Transaction verified via balance" };
          }
        }
      }

      return {
        verified: false,
        message: "Could not find matching transfer",
      };
    } catch (err: any) {
      // Network error — retry unless last attempt
      if (attempt < MAX_RETRIES - 1) continue;
      console.error("XNT verification error:", err);
      return { verified: false, message: err?.message || "Verification failed" };
    }
  }

  return { verified: false, message: "Verification timed out" };
}

/**
 * Build a single transaction with two transfers (80% artist + 20% treasury).
 * Buyer signs once, both transfers execute atomically.
 */
export async function buildSplitPurchaseTx(
  fromPubKey: PublicKey,
  artistAddress: string,
  priceLamports: number
): Promise<Transaction> {
  const connection = getX1Connection();
  const { blockhash } = await connection.getLatestBlockhash();

  const artistLamports = Math.floor(priceLamports * PURCHASE_ARTIST_SHARE);
  const treasuryLamports = priceLamports - artistLamports;

  const tx = new Transaction();
  
  // 80% to artist
  tx.add(
    SystemProgram.transfer({
      fromPubkey: fromPubKey,
      toPubkey: new PublicKey(artistAddress),
      lamports: artistLamports,
    })
  );

  // 20% to treasury
  tx.add(
    SystemProgram.transfer({
      fromPubkey: fromPubKey,
      toPubkey: getTreasuryPubkey(),
      lamports: treasuryLamports,
    })
  );

  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPubKey;
  return tx;
}

/**
 * Verify a split purchase transaction has both required transfers:
 * 1. 80% to the artist
 * 2. 20% to the treasury
 */
export async function verifySplitPurchase(
  txSignature: string,
  senderWallet: string,
  artistAddress: string,
  priceLamports: number
): Promise<{ verified: boolean; message: string }> {
  const TREASURY = TREASURY_ADDRESS;
  const expectedArtist = Math.floor(priceLamports * PURCHASE_ARTIST_SHARE);
  const expectedTreasury = priceLamports - expectedArtist;

  const MAX_RETRIES = 8;
  const BASE_DELAY = 500;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, BASE_DELAY * Math.pow(1.5, attempt)));
    }

    try {
      const response = await fetch("https://rpc.mainnet.x1.xyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "x1-split-" + txSignature.slice(0, 8),
          method: "getTransaction",
          params: [
            txSignature,
            { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" },
          ],
        }),
      });

      if (!response.ok) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: `RPC error: ${response.status}` };
      }

      const data = await response.json();

      if (data.error) {
        if (data.error?.code === -32009 && attempt < MAX_RETRIES - 1) continue;
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: `RPC: ${data.error?.message || "unknown error"}` };
      }

      const tx = data?.result;
      if (!tx) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: "Transaction not found on-chain" };
      }

      const meta = tx.meta;
      if (!meta) {
        if (attempt < MAX_RETRIES - 1) continue;
        return { verified: false, message: "Transaction metadata not available" };
      }

      if (meta.err) {
        return { verified: false, message: "Transaction failed on-chain" };
      }

      const instructions = tx.transaction?.message?.instructions || [];
      const senderPubkey = new PublicKey(senderWallet).toBase58();
      const artistPubkey = new PublicKey(artistAddress).toBase58();

      let foundArtistTransfer = false;
      let artistAmount = 0;
      let foundTreasuryTransfer = false;
      let treasuryAmount = 0;

      for (const ix of instructions) {
        const program = ix.programId || ix.program || "";
        if (program !== "11111111111111111111111111111111") continue;

        const parsed = ix.parsed;
        if (!parsed || parsed.type !== "transfer") continue;

        const info = parsed.info || {};
        const source = info.source || "";
        const destination = info.destination || "";
        const lamports = parseInt(String(info.lamports || "0"), 10);

        if (source !== senderPubkey) continue;

        if (destination === artistPubkey) {
          foundArtistTransfer = true;
          artistAmount = lamports;
        } else if (destination === TREASURY) {
          foundTreasuryTransfer = true;
          treasuryAmount = lamports;
        }
      }

      if (!foundArtistTransfer) {
        return { verified: false, message: "No transfer to artist found in transaction" };
      }
      if (!foundTreasuryTransfer) {
        return { verified: false, message: "No transfer to treasury found in transaction" };
      }

      // Check minimums (accept more than expected — buyer might tip)
      if (artistAmount < expectedArtist) {
        return {
          verified: false,
          message: `Artist share: expected ${(expectedArtist / LAMPORTS_PER_SOL).toFixed(4)} XNT, sent ${(artistAmount / LAMPORTS_PER_SOL).toFixed(4)} XNT`,
        };
      }
      if (treasuryAmount < expectedTreasury) {
        return {
          verified: false,
          message: `Treasury share: expected ${(expectedTreasury / LAMPORTS_PER_SOL).toFixed(4)} XNT, sent ${(treasuryAmount / LAMPORTS_PER_SOL).toFixed(4)} XNT`,
        };
      }

      return {
        verified: true,
        message: `Split verified: ${(artistAmount / LAMPORTS_PER_SOL).toFixed(4)} XNT → artist + ${(treasuryAmount / LAMPORTS_PER_SOL).toFixed(4)} XNT → treasury`,
      };
    } catch (err: any) {
      if (attempt < MAX_RETRIES - 1) continue;
      console.error("Split purchase verification error:", err);
      return { verified: false, message: err?.message || "Verification failed" };
    }
  }

  return { verified: false, message: "Verification timed out" };
}
