// src/components/TermsModal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TermsModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-bold text-zinc-100">Terms of Use</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 text-sm text-zinc-400 leading-relaxed space-y-5">
          <p className="text-zinc-500 text-xs">Last updated: June 2025</p>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">1. Description of Service</h3>
            <p>BIOGRID ("the Service") is a web-based research tool that provides search and visualization access to publicly available data from the U.S. Food and Drug Administration (FDA) Open Data API (openFDA). The Service is operated independently and is not affiliated with, endorsed by, or sponsored by the FDA or any government agency.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">2. Not Medical Advice</h3>
            <p>The information displayed by BIOGRID is provided for <strong className="text-zinc-300">research and informational purposes only</strong>. It does not constitute medical advice, diagnosis, or treatment recommendations. You should not rely on the Service as a substitute for professional medical judgment. Always consult a qualified healthcare provider regarding medical decisions.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">3. Data Source and Accuracy</h3>
            <p>All adverse event, recall, and product data is sourced from the openFDA API, which is maintained by the U.S. Department of Health and Human Services. The FDA makes this data publicly available under open-data principles; however, it <strong className="text-zinc-300">may be incomplete, contain errors, or reflect unverified voluntary reports</strong>. BIOGRID makes no representations as to the accuracy, completeness, or fitness for purpose of any data retrieved.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">4. Account Responsibility</h3>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account. We reserve the right to suspend or terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">5. Acceptable Use</h3>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
              <li>Make clinical or safety decisions about individual patients</li>
              <li>Scrape, harvest, or systematically extract data at scale in violation of openFDA's terms</li>
              <li>Misrepresent FDA data or create misleading regulatory claims</li>
              <li>Engage in any unlawful activity or violate third-party rights</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
            </ul>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">6. Limitation of Liability</h3>
            <p>To the maximum extent permitted by law, BIOGRID and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or reliance on the Service, including but not limited to errors in FDA data, service interruptions, or loss of saved data.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">7. Privacy</h3>
            <p>We collect and store only the data necessary to provide the Service: your authentication information (via Firebase Authentication), saved searches, saved reports, and the profile information you provide during registration. We do not sell, rent, or share your personal data with third parties for commercial purposes. Data is stored in Google Firebase in the United States. By using the Service, you consent to this storage.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">8. Modifications to Terms</h3>
            <p>We may update these Terms of Use from time to time. Continued use of the Service after changes are posted constitutes acceptance of the revised terms. We will make reasonable efforts to notify registered users of material changes.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">9. Governing Law</h3>
            <p>These Terms shall be governed by the laws of the United States, without regard to conflict of law principles. Any disputes shall be resolved in courts of competent jurisdiction.</p>
          </section>

          <section>
            <h3 className="text-zinc-200 font-semibold mb-2">10. Contact</h3>
            <p>Questions about these Terms may be directed to the BIOGRID development team via the feedback link in the application.</p>
          </section>
        </div>
        <div className="px-6 py-4 border-t border-zinc-800 shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm rounded-xl transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
