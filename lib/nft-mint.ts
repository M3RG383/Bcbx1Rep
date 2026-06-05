import { Connection, PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import {
  getMintLen,
  createInitializeMintInstruction,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  createInitializeMetadataPointerInstruction,
} from "@solana/spl-token";
import { createInitializeInstruction, pack } from "@solana/spl-token-metadata";
import { X1_RPC } from "./x1";

const X1_MAINNET = X1_RPC;

function getMintAuthority(): Keypair {
  const raw = process.env.PLATFORM_MINT_PRIVATE_KEY;
  if (!raw) throw new Error("PLATFORM_MINT_PRIVATE_KEY not set");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export function getMintAuthorityPubkey(): string {
  return getMintAuthority().publicKey.toBase58();
}

/**
 * Create a Token-2022 NFT mint:
 *  - MetadataPointer extension (tells wallets where metadata lives)
 *  - TokenMetadata extension (name, symbol, URI stored on-chain)
 *  - 0 decimals (NFT)
 *
 * Returns the mint public key.
 */
export async function createNftMint(
  connection: Connection,
  authority: Keypair,
  name: string,
  symbol: string,
  uri: string,
  additionalMetadata: [string, string][] = [],
): Promise<PublicKey> {
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;

  // Pack metadata to determine its exact byte size
  const packed = pack(
    {
      updateAuthority: authority.publicKey,
      mint,
      name,
      symbol,
      uri,
      additionalMetadata,
    },
  );

  // Compute account space: base mint + MetadataPointer(fixed) + TokenMetadata(variable)
  const mintLen = getMintLen(
    [ExtensionType.MetadataPointer],
    { [ExtensionType.TokenMetadata]: packed.byteLength },
  );
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction().add(
    // 1. Create mint account
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      newAccountPubkey: mint,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // 2. Metadata pointer — tells wallets to look at the mint itself for metadata
    createInitializeMetadataPointerInstruction(
      mint,
      authority.publicKey,
      authority.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    // 3. Initialize mint (0 decimals = NFT)
    createInitializeMintInstruction(
      mint,
      0,
      authority.publicKey,
      authority.publicKey,
      TOKEN_2022_PROGRAM_ID,
    ),
    // 4. Initialize on-chain metadata on the mint account itself
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint,
      metadata: mint,
      name,
      symbol,
      uri,
      mintAuthority: authority.publicKey,
      updateAuthority: authority.publicKey,
    }),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(mintKp, authority);

  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });

  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return mint;
}

/**
 * Mint 1 NFT (Token-2022) to buyer after purchase.
 * NFT name format: "BcBx1: Track Title"
 */
export async function mintNftToBuyer(
  buyerWallet: string,
  trackTitle: string,
  artistName: string,
  blobUrl: string,
  albumArtUrl: string | null,
): Promise<string> {
  const connection = new Connection(X1_MAINNET, "confirmed");
  const authority = getMintAuthority();

  const nftName = `BcBx1: ${trackTitle}`;
  const metadataId = `bcbx1-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://blockchainbeats.xyz";

  // Store metadata JSON for the /api/nft-metadata/[id] endpoint
  const store = ((globalThis as any).__nftMetaStore ||= new Map<string, any>());
  store.set(metadataId, {
    name: nftName,
    symbol: "BCBX1",
    description: `Blockchain Beats track: ${trackTitle} by ${artistName}`,
    image: albumArtUrl || `${baseUrl}/logo.png`,
    external_url: `${baseUrl}/browse`,
    attributes: [
      { trait_type: "Artist", value: artistName },
      { trait_type: "Track", value: trackTitle },
      { trait_type: "Network", value: "X1" },
      { trait_type: "Platform", value: "Blockchain Beats" },
    ],
    properties: {
      files: [{ uri: blobUrl, type: "audio/mpeg" }],
    },
  });

  const metadataUri = `${baseUrl}/api/nft-metadata/${metadataId}`;
  const mintPubkey = await createNftMint(connection, authority, nftName, "BCBX1", metadataUri, [
    ["artist", artistName],
    ["track", trackTitle],
    ["network", "X1"],
  ]);

  // Create ATA for buyer and mint 1 token
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    authority,
    mintPubkey,
    new PublicKey(buyerWallet),
    undefined,  // allowOwnerOffCurve
    "confirmed",  // commitment
    undefined,  // confirmOptions
    TOKEN_2022_PROGRAM_ID,
  );

  await mintTo(
    connection,
    authority,
    mintPubkey,
    ata.address,
    authority,
    1,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID,
  );

  return mintPubkey.toBase58();
}

/** Retrieve stored NFT metadata by ID */
export function getStoredNftMetadata(id: string): Record<string, any> | null {
  const store = (globalThis as any).__nftMetaStore;
  return store?.get(id) || null;
}