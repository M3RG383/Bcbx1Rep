"use client";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-14">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
          Terms of <span className="accent-text">Service</span>
        </h1>
        <p className="text-text-secondary text-sm">
          Last updated: June 1, 2026
        </p>
      </div>

      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Blockchain Beats (the &ldquo;Platform&rdquo;), you agree to be bound by
            these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Platform.
            We reserve the right to update these Terms at any time; continued use constitutes acceptance
            of the changes.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. Account Registration</h2>
          <p>
            You must connect a compatible wallet to upload or purchase content. You are solely responsible
            for maintaining the security of your wallet and any activity conducted through it. You represent
            that all information you provide is accurate and complete.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. Content Ownership & Licensing</h2>
          <p className="mb-4">
            You retain all ownership rights to the music, artwork, and metadata you upload
            (&ldquo;Content&rdquo;). By uploading Content to the Platform, you grant Blockchain Beats a
            non-exclusive, worldwide, royalty-free license to:
          </p>
          <ul className="space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Host, store, and display your Content on the Platform for streaming, preview, and purchase purposes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Distribute your Content to connected services and platforms that enhance marketplace functionality</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Index, analyze, and process your Content for catalog organization, recommendation systems, and cross-platform discovery</span>
            </li>
          </ul>
          <p className="text-[#60a5fa] border-l-2 border-[#3b82f6] pl-4 py-2 bg-[rgba(108,140,255,0.05)] rounded-r-lg">
            <strong>Protection of Artistic Content:</strong> Blockchain Beats firmly believes that artistic
            expression, creative ideas, and original content belong to their creators. The Platform
            frowns upon and does not permit the sharing, distribution, or supply of uploaded artistic
            content — including audio recordings, lyrics, compositions, artwork, and metadata — to
            third-party large language models, artificial intelligence platforms, or machine learning
            training systems. Your creative work is yours alone. We will not feed it to the machine.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Representations & Warranties</h2>
          <p className="mb-3">You represent and warrant that:</p>
          <ul className="space-y-2 mb-3">
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>You own all rights to your Content or have obtained all necessary licenses, permissions, and clearances</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Your Content does not infringe on any third-party copyright, trademark, patent, or other intellectual property right</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>You are responsible for all applicable royalties, mechanical licenses, synchronization licenses, and performance fees</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Your Content does not contain malware, viruses, or any harmful code</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Marketplace & Payments</h2>
          <p className="mb-3">
            All sales are final. Blockchain Beats facilitates the transaction between buyer and seller
            as a marketplace. Prices are set by the artist. Blockchain Beats retains a platform fee on
            each sale as disclosed at the time of listing.
          </p>
          <p className="mb-3">
            All transactions occur on-chain via the X1 Network. You are responsible for any network fees
            (gas) associated with your transactions. Refunds are handled at the discretion of the artist
            unless required by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Prohibited Conduct</h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="space-y-2 mb-3">
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Upload Content you do not have the rights to</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Use the Platform for any illegal activity or in violation of any applicable law</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Attempt to manipulate prices, sales, or platform metrics through fraudulent means</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Interfere with the Platform&rsquo;s operation, including introducing malware or conducting denial-of-service attacks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3b82f6] mt-1">•</span>
              <span>Reverse-engineer, decompile, or attempt to extract the source code of the Platform</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Copyright & Plagiarism Protection</h2>
          <p className="mb-3">
            Blockchain Beats employs automated spectral fingerprinting to detect potential copyright conflicts
            between uploaded content and existing tracks on the Platform. This scanning runs asynchronously
            during low-activity hours and does not delay publishing.
          </p>
          <p className="mb-3">
            If a potential conflict is detected, the artist will be notified. The Platform reserves the right
            to flag, restrict, or remove content that demonstrably infringes on third-party rights. Artists
            retain the ability to publish content pending scan results and may provide rights documentation
            to resolve any flags.
          </p>
          <p>
            If you believe Content on the Platform infringes your copyright, please contact us with relevant
            details. We will promptly investigate and remove infringing material as required by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">8. Limitation of Liability</h2>
          <p>
            Blockchain Beats is provided &ldquo;as is&rdquo; without warranties of any kind, express or
            implied. To the maximum extent permitted by law, Blockchain Beats shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages arising from your use of
            the Platform. In no event shall our total liability exceed the amount you have paid us in the
            twelve (12) months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to the Platform at any time, without
            notice, for conduct that we believe violates these Terms or is harmful to other users, third
            parties, or the Platform itself. Upon termination, your right to use the Platform immediately
            ceases.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">10. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction
            in which Blockchain Beats operates, without regard to its conflict of law provisions. Any
            disputes arising under these Terms shall be resolved through binding arbitration.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">11. Contact</h2>
          <p>
            For questions about these Terms, please reach out via the Platform&rsquo;s support channels or
            contact us directly through our community.
          </p>
        </section>
      </div>

      {/* Bottom back link */}
      <div className="text-center mt-12">
        <a href="/upload" className="bubble-btn bubble-btn-outline">
          ← Back to Upload
        </a>
      </div>
    </div>
  );
}