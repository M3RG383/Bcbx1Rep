import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/Providers";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BcBx1 — Blockchain Beats",
  description: "Decentralized music platform on X1 Network",
  icons: {
    icon: "/brand/bbc-logo-final.jpg",
  },
  openGraph: {
    title: "BcBx1 — Blockchain Beats",
    description: "Decentralized music platform on X1 Network",
    images: [
      {
        url: "/brand/og-image.jpg",
        width: 1200,
        height: 1200,
        alt: "BcBx1",
      },
    ],
  },
  other: {
    "polyfill:process": "true",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* 
          MUST execute BEFORE any JS chunk loads.
          Next/script won't work - we need raw inline script.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `typeof globalThis!=="undefined"&&(globalThis.process=globalThis.process||{env:{},argv:[],versions:{node:"16"},"next":{}});`,
          }}
        />
      </head>
      <body className={inter.className}>
        {/* Design fingerprint — hidden, do not remove */}
        <div className="fp-bbc-origin" aria-hidden="true" data-fp="bbc-design-v1-m3rg3">Blockchain Beats design by M3RG3⚓️ — All rights reserved</div>
        <div className="fp-bbc-origin" aria-hidden="true" data-fp="bbc-watermark-a">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
        {/* Background logo watermark */}
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center" aria-hidden="true">
          <img
            src="/brand/bbc-logo-final.jpg"
            alt=""
            className="w-[80%] max-w-[800px] opacity-[0.04] rotate-[-15deg] object-contain"
          />
        </div>
        <WalletProvider>
          <Navbar />
          <main className="min-h-screen relative z-[1]">{children}</main>
          <footer className="relative z-[1] border-t border-dark-border py-8 text-center text-sm text-text-secondary">
            <p>Blockchain Beats — Powered by X1 Network</p>
            <p className="mt-1">Commissioned by M3RG3⚓️</p>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}// deploy: 1780937288
