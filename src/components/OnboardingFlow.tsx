// src/components/OnboardingFlow.tsx
import React, { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../lib/firestore';
import TermsModal from './TermsModal';

interface Props {
  uid: string;
  email: string;
  onComplete: (profile: UserProfile) => Promise<void>;
}

const ROLES = [
  'Researcher / Scientist',
  'Clinician / Healthcare Provider',
  'Regulator / Government',
  'Industry / Pharma / MedTech',
  'Student',
  'Journalist / Media',
  'Legal / Compliance',
  'Other',
];

const STEPS = ['Your Name', 'Your Role', 'Agreement'];

export default function OnboardingFlow({ uid, email, onComplete }: Props) {
  const [step, setStep]         = useState(0);
  const [firstName, setFirst]   = useState('');
  const [lastName, setLast]     = useState('');
  const [company, setCompany]   = useState('');
  const [role, setRole]         = useState('');
  const [agreed, setAgreed]     = useState(false);
  const [marketing, setMkt]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [showTerms, setShowTerms] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);
  const [termsScrolled, setTermsScrolled] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!firstName.trim()) e.firstName = 'First name is required';
      if (!lastName.trim())  e.lastName  = 'Last name is required';
    }
    if (step === 1) {
      if (!role) e.role = 'Please select your role';
    }
    if (step === 2) {
      if (!agreed) e.agreed = 'You must accept the Terms of Use to continue';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep(s => s + 1); };
  const back = () => { setErrors({}); setStep(s => s - 1); };

  const handleComplete = async () => {
    if (!validate()) return;
    setLoading(true);
    const profile: UserProfile = {
      uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim(),
      role,
      agreedToTerms: true,
      termsAgreedAt: Date.now(),
      marketingConsent: marketing,
      createdAt: Date.now(),
    };
    await onComplete(profile);
    setLoading(false);
  };

  const handleTermsScroll = () => {
    if (!termsRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = termsRef.current;
    if (scrollHeight - scrollTop - clientHeight < 60) setTermsScrolled(true);
  };

  const progress = ((step) / STEPS.length) * 100;

  return (
    <>
      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950">
        {/* Ambient */}
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-blue-600/8 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-60 h-60 rounded-full bg-violet-600/8 blur-[80px] pointer-events-none" />

        <div className="relative bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-zinc-800">
            <div
              className="h-1 bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-8">
            {/* Logo + step */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                  <span className="text-black font-black text-xs">B</span>
                </div>
                <span className="font-black text-zinc-300 text-xs tracking-[0.15em] uppercase">BIOGRID</span>
              </div>
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                      i < step  ? 'bg-blue-600 text-white' :
                      i === step ? 'bg-zinc-700 text-zinc-100 ring-2 ring-blue-500/40' :
                                   'bg-zinc-800 text-zinc-600'
                    )}>
                      {i < step ? <Check className="w-3 h-3" /> : i + 1}
                    </div>
                    {i < STEPS.length - 1 && <div className={cn('w-5 h-px', i < step ? 'bg-blue-600' : 'bg-zinc-800')} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* ── STEP 0: Name ── */}
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Let's get started</h2>
                <p className="text-zinc-500 text-sm mb-7">Tell us a bit about yourself — signed in as <span className="text-zinc-400 font-medium">{email}</span></p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">First Name <span className="text-red-400">*</span></label>
                    <input
                      type="text" value={firstName} onChange={e => setFirst(e.target.value)}
                      placeholder="Jane"
                      className={cn(
                        "w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-all",
                        errors.firstName ? "border-red-600 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-700 focus:border-blue-500 focus:ring-blue-500/30"
                      )}
                    />
                    {errors.firstName && <p className="text-[11px] text-red-400 mt-1 ml-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Last Name <span className="text-red-400">*</span></label>
                    <input
                      type="text" value={lastName} onChange={e => setLast(e.target.value)}
                      placeholder="Smith"
                      className={cn(
                        "w-full bg-zinc-800 border rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 transition-all",
                        errors.lastName ? "border-red-600 focus:border-red-500 focus:ring-red-500/20" : "border-zinc-700 focus:border-blue-500 focus:ring-blue-500/30"
                      )}
                    />
                    {errors.lastName && <p className="text-[11px] text-red-400 mt-1 ml-1">{errors.lastName}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 1: Role ── */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Your background</h2>
                <p className="text-zinc-500 text-sm mb-7">Help us understand how you'll use BIOGRID</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Organization / Company <span className="text-zinc-600">(optional)</span></label>
                    <input
                      type="text" value={company} onChange={e => setCompany(e.target.value)}
                      placeholder="Acme Pharma, Stanford University…"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2">Role <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLES.map(r => (
                        <button
                          key={r} type="button"
                          onClick={() => { setRole(r); setErrors(prev => ({ ...prev, role: '' })); }}
                          className={cn(
                            'text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all',
                            role === r
                              ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    {errors.role && <p className="text-[11px] text-red-400 mt-2 ml-1">{errors.role}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2: Terms ── */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-black text-zinc-50 mb-1">Almost done</h2>
                <p className="text-zinc-500 text-sm mb-5">Please review and accept our terms to continue</p>

                {/* Inline terms preview */}
                <div
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 h-48 overflow-y-auto text-xs text-zinc-400 leading-relaxed mb-4 space-y-3"
                >
                  <p className="font-bold text-zinc-300">BIOGRID Terms of Use — Summary</p>
                  <p><strong className="text-zinc-300">Research tool only.</strong> BIOGRID provides access to FDA open data for research purposes. It is not medical advice and should not be used to make clinical decisions.</p>
                  <p><strong className="text-zinc-300">Data from openFDA.</strong> All data comes from the publicly available openFDA API. It may be incomplete or contain unverified voluntary reports. We make no warranty of accuracy.</p>
                  <p><strong className="text-zinc-300">Your account.</strong> You are responsible for keeping your account secure. We may suspend accounts that violate these terms.</p>
                  <p><strong className="text-zinc-300">No selling your data.</strong> We do not sell your personal information. Data is stored in Google Firebase.</p>
                  <p><strong className="text-zinc-300">Limitation of liability.</strong> We are not liable for any damages arising from use of the service or reliance on FDA data.</p>
                  <button onClick={() => setShowTerms(true)} className="text-blue-500 hover:text-blue-400 underline underline-offset-2">
                    Read full Terms of Use →
                  </button>
                </div>

                <div className="space-y-3">
                  <label className={cn(
                    "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                    agreed ? "border-blue-500/50 bg-blue-600/10" : "border-zinc-700 bg-zinc-800/40",
                    errors.agreed ? "border-red-600/60" : ""
                  )}>
                    <input
                      type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setErrors(prev => ({ ...prev, agreed: '' })); }}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-600 accent-blue-600 shrink-0"
                    />
                    <span className="text-xs text-zinc-300">
                      <span className="font-semibold">I agree to the Terms of Use</span> and understand that BIOGRID provides FDA data for research purposes only, not medical advice. <span className="text-red-400">*</span>
                    </span>
                  </label>
                  {errors.agreed && <p className="text-[11px] text-red-400 ml-1">{errors.agreed}</p>}

                  <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-700 bg-zinc-800/40 cursor-pointer hover:border-zinc-600 transition-all">
                    <input
                      type="checkbox" checked={marketing} onChange={e => setMkt(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-zinc-600 accent-blue-600 shrink-0"
                    />
                    <span className="text-xs text-zinc-400">
                      I'd like to receive occasional product updates, new features, and research tips from BIOGRID. <span className="text-zinc-600">(Optional — you can unsubscribe any time)</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              {step > 0 ? (
                <button onClick={back} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm font-semibold transition-all">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <button onClick={next} className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 rounded-xl text-sm font-bold text-white transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Get Started
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
