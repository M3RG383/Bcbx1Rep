"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

// Signed auth session — user proves wallet ownership once, then can transact silently
// Session duration is read dynamically from localStorage (default 15 min)
const SESSION_KEY = "bb_auth_session";

function getSessionDuration(): number {
  try {
    const stored = localStorage.getItem("bb_wallet_timeout");
    if (stored) {
      const val = parseInt(stored);
      if (!isNaN(val) && val > 0) return val * 60 * 1000;
    }
  } catch {}
  return 15 * 60 * 1000; // default 15 min
}
const AUTH_MESSAGE = "Blockchain Beats Auth\n\nSign this message to prove you own this wallet.\n\nSession: ";

interface AuthSession {
  wallet: string;
  signature: string;
  expiresAt: number;
}

interface WalletState {
  connected: boolean;
  authenticating: boolean;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  ensureAuth: () => Promise<boolean>;
}

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: AuthSession = JSON.parse(raw);
    if (s.expiresAt > Date.now() && s.wallet && s.signature) return s;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  } catch {
    return null;
  }
}

function saveSession(s: AuthSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // If localStorage is full, fall back to sessionStorage
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

const WalletContext = createContext<WalletState>({
  connected: false,
  authenticating: false,
  publicKey: null,
  connect: async () => {},
  disconnect: () => {},
  ensureAuth: async () => false,
});

export function useWallet() {
  return useContext(WalletContext);
}

function findProvider(win: any) {
  const candidates = [
    { id: "x1wallet", getter: () => win.x1wallet },
    { id: "x1", getter: () => win.x1 },
    { id: "phantom", getter: () => win.phantom?.solana },
    { id: "solflare", getter: () => win.solflare },
    { id: "backpack", getter: () => win.backpack?.solana },
  ];
  for (const wp of candidates) {
    const prov = wp.getter();
    if (prov && typeof prov.connect === 'function') return prov;
  }
  return null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const lastActivityRef = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // On mount, try to restore a previous auth session
  useEffect(() => {
    const s = loadSession();
    if (s) {
      sessionRef.current = s;
      const win = window as any;
      const prov = findProvider(win);
      if (prov && s.wallet) {
        setProvider(prov);
        setConnected(true);
        setPublicKey(s.wallet);
      }
    }
  }, []);

  // ensureAuth: prompt user to sign a message if no valid session exists
  // Called by all transactional actions (upload, purchase, etc.)
  const ensureAuth = useCallback(async (): Promise<boolean> => {
    // Check if we have a valid cached session
    const existing = sessionRef.current || loadSession();
    if (existing && existing.expiresAt > Date.now()) return true;

    // No valid session — prompt wallet to sign
    try {
      const win = window as any;
      const prov = findProvider(win);
      if (!prov) return false;

      // Ensure wallet is connected
      const pk = prov.publicKey?.toString() || null;
      if (!pk) return false;

      // Sign auth message
      const timestamp = Date.now();
      const message = AUTH_MESSAGE + timestamp;
      const encoded = new TextEncoder().encode(message);

      let signature: string;
      if (typeof prov.signMessage === 'function') {
        const sigResult = await prov.signMessage(encoded);
        signature = typeof sigResult === 'string' ? sigResult : 
                    sigResult?.signature ? Buffer.from(sigResult.signature).toString('hex') :
                    Buffer.from(sigResult).toString('hex');
      } else {
        // Fallback: sign a 0-lamport transfer (some wallets don't support signMessage)
        const { Transaction, SystemProgram, PublicKey, Connection } = await import("@solana/web3.js");
        const conn = new Connection("https://rpc.mainnet.x1.xyz", "confirmed");
        const { blockhash } = await conn.getLatestBlockhash();
        const tx = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: new PublicKey(pk), toPubkey: new PublicKey(pk), lamports: 0 })
        );
        tx.recentBlockhash = blockhash;
        tx.feePayer = new PublicKey(pk);
        const signed = await prov.signTransaction(tx);
        signature = signed.signatures?.[0]?.toString() || Buffer.from(signed.serialize()).toString('hex');
      }

      const session: AuthSession = {
        wallet: pk,
        signature,
        expiresAt: Date.now() + getSessionDuration(),
      };
      sessionRef.current = session;
      saveSession(session);
      return true;
    } catch (e) {
      console.error("Auth signing failed:", e);
      return false;
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const win = window as any;
      const prov = findProvider(win);
      if (!prov) {
        alert("Connect your X1 wallet\n\nPlease install X1 Wallet, Phantom, Solflare, or Backpack browser extension first, then click Connect again.");
        return;
      }

      setAuthenticating(true);

      // Always trigger wallet popup — even if wallet shows publicKey,
      // we need an explicit user approval for a signing session
      let newPk: string | null = null;
      if (prov.connect) {
        const resp = await prov.connect();
        newPk = resp?.publicKey?.toString() || prov?.publicKey?.toString() || null;
      } else {
        newPk = prov.publicKey?.toString() || null;
      }

      if (!newPk) {
        throw new Error("Could not get wallet address");
      }

      setProvider(prov);
      setPublicKey(newPk);
      setConnected(true);

      // Immediately establish auth session (sign a message to prove ownership)
      await ensureAuth();
    } catch (e: any) {
      console.error("Wallet connection failed:", e);
      setConnected(false);
      setPublicKey(null);
    } finally {
      setAuthenticating(false);
    }
  }, [ensureAuth]);

  const disconnect = useCallback(() => {
    if (provider?.disconnect) provider.disconnect().catch(() => {});
    setProvider(null);
    setConnected(false);
    setAuthenticating(false);
    setPublicKey(null);
    sessionRef.current = null;
    clearSession();
  }, [provider]);

  // Activity tracking for auto-disconnect
  useEffect(() => {
    const handleActivity = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, []);

  // Periodic inactivity check — runs every 30s
  useEffect(() => {
    const checkInactivity = () => {
      if (!connected || !publicKey) return;
      const elapsed = Date.now() - lastActivityRef.current;
      const duration = getSessionDuration();
      if (elapsed > duration) {
        console.log("Auto-disconnect due to inactivity");
        disconnect();
      }
    };
    const interval = setInterval(checkInactivity, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, disconnect]);

  // Listen for settings changes
  useEffect(() => {
    const handleSettings = () => {
      // Inactivity check will pick up the new timeout on next interval
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("bb:settingsChanged", handleSettings);
    window.addEventListener("bb:inactivityCheck", handleSettings);
    return () => {
      window.removeEventListener("bb:settingsChanged", handleSettings);
      window.removeEventListener("bb:inactivityCheck", handleSettings);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ connected, authenticating, publicKey, connect, disconnect, ensureAuth }}>
      {children}
    </WalletContext.Provider>
  );
}