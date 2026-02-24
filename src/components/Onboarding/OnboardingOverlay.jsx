import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../hooks/useTheme';

const ONBOARDING_KEY = 'lp_onboarding_complete';

// ─── Step definitions ────────────────────────────────────────
const steps = [
  {
    id: 'welcome',
    target: null,
    title: 'Welcome to LP Player',
    description: 'Your personal dashboard for managing local projects. Let\u2019s take a quick tour.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16">
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <circle cx="24" cy="24" r="14" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.2" />
        <circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.8" />
        <path d="M24 2v6M24 40v6M2 24h6M40 24h6" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      </svg>
    ),
  },
  {
    id: 'add-app',
    target: '[data-onboarding="add-app"]',
    title: 'Add Your First Project',
    description: 'Click here to register a local project. Just point to a folder \u2014 LP Player auto-detects the environment, commands, and dependencies.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <rect x="6" y="6" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        <line x1="24" y1="16" x2="24" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="16" y1="24" x2="32" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'settings',
    target: '[data-onboarding="settings"]',
    title: 'Configure Settings',
    description: 'Customize themes, set up AI providers for auto-install, manage ports, and configure sound effects \u2014 all from one place.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12">
        <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M24 4v6M24 38v6M4 24h6M38 24h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.1 10.1l4.24 4.24M33.66 33.66l4.24 4.24M10.1 37.9l4.24-4.24M33.66 14.34l4.24-4.24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'launch',
    target: null,
    title: 'You\u2019re All Set',
    description: 'Add a project, hit the power knob, and watch it spin up. Real-time terminal, system monitoring, and instant search \u2014 all in one dashboard.',
    icon: (
      <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16">
        <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <polygon points="20,16 20,32 34,24" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
];

// ─── Spotlight cutout for targeting elements ─────────────────
function Spotlight({ targetRect, isDarkMode }) {
  if (!targetRect) return null;

  const padding = 8;
  const borderRadius = 12;
  const x = targetRect.left - padding;
  const y = targetRect.top - padding;
  const w = targetRect.width + padding * 2;
  const h = targetRect.height + padding * 2;

  return (
    <svg className="fixed inset-0 w-full h-full z-[60] pointer-events-none" preserveAspectRatio="none">
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={borderRadius} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.82)" mask="url(#spotlight-mask)" />
      {/* Accent ring around target */}
      <rect
        x={x - 2} y={y - 2}
        width={w + 4} height={h + 4}
        rx={borderRadius + 2}
        fill="none"
        stroke={isDarkMode ? 'rgba(188,204,15,0.5)' : 'rgba(122,138,11,0.5)'}
        strokeWidth="2"
      >
        <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ─── Dot indicator ───────────────────────────────────────────
function StepDots({ current, total, isDarkMode }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === current ? 24 : 8,
            height: 8,
            backgroundColor: i === current
              ? (isDarkMode ? '#bccc0f' : '#7a8a0b')
              : (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        />
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────
export default function OnboardingOverlay() {
  const { isDarkMode } = useTheme();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const panelRef = useRef(null);

  // Check if onboarding should show
  useEffect(() => {
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Small delay so the app finishes rendering
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Track target element position
  useEffect(() => {
    if (!visible) return;

    const currentStep = steps[step];
    if (!currentStep.target) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTargetRect(null);
      return;
    }

    function updateRect() {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    }

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [visible, step]);

  const finish = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }, [step, finish]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // Position the panel near the target, or center it
  const getPanelStyle = () => {
    if (!targetRect) return {};

    const panelWidth = 380;
    const panelHeight = 260;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: below the target, centered horizontally
    let left = targetRect.left + targetRect.width / 2 - panelWidth / 2;
    let top = targetRect.bottom + gap;

    // If panel goes off right edge
    if (left + panelWidth > vw - 16) left = vw - panelWidth - 16;
    // If panel goes off left edge
    if (left < 16) left = 16;
    // If panel goes off bottom, place above
    if (top + panelHeight > vh - 16) {
      top = targetRect.top - panelHeight - gap;
    }
    // If still off top, center vertically
    if (top < 16) top = vh / 2 - panelHeight / 2;

    return { position: 'fixed', left, top, width: panelWidth };
  };

  if (!visible) return null;

  const currentStep = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const isCentered = !currentStep.target || !targetRect;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop — solid for centered, spotlight cutout for targeted */}
          {isCentered ? (
            <motion.div
              className="fixed inset-0 z-[60] bg-black/85"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="z-[60]"
            >
              <Spotlight targetRect={targetRect} isDarkMode={isDarkMode} />
            </motion.div>
          )}

          {/* Panel */}
          <motion.div
            ref={panelRef}
            className={`z-[70] ${isCentered ? 'fixed inset-0 flex items-center justify-center p-4' : ''}`}
            style={!isCentered ? getPanelStyle() : undefined}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            key={step}
          >
            <div
              className={`
                rounded-2xl shadow-2xl overflow-hidden backdrop-blur-sm
                ${isCentered ? 'w-full max-w-sm' : 'w-full'}
                ${isDarkMode
                  ? 'bg-gradient-to-br from-[#bccc0f]/10 to-[#0a0a0a] border border-[#bccc0f]/25'
                  : 'bg-gradient-to-br from-white to-gray-50 border border-[#7a8a0b]/30'
                }
              `}
            >
              {/* Step content */}
              <div className="p-6 text-center">
                {/* Icon */}
                <motion.div
                  className={`
                    mx-auto mb-4
                    ${isDarkMode ? 'text-[#bccc0f]' : 'text-[#7a8a0b]'}
                  `}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                >
                  {currentStep.icon}
                </motion.div>

                {/* Title */}
                <motion.h3
                  className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {currentStep.title}
                </motion.h3>

                {/* Description */}
                <motion.p
                  className={`text-sm leading-relaxed mb-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentStep.description}
                </motion.p>

                {/* Dots */}
                <div className="mb-5">
                  <StepDots current={step} total={steps.length} isDarkMode={isDarkMode} />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Skip or Back */}
                  <div className="flex-1 text-left">
                    {isFirst ? (
                      <button
                        onClick={skip}
                        className={`text-xs transition-colors ${
                          isDarkMode ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        Skip tour
                      </button>
                    ) : (
                      <button
                        onClick={prev}
                        className={`text-sm transition-colors ${
                          isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'
                        }`}
                      >
                        &larr; Back
                      </button>
                    )}
                  </div>

                  {/* Right: Next / Get Started */}
                  <motion.button
                    onClick={next}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className={`
                      px-5 py-2 rounded-lg text-sm font-semibold transition-colors
                      ${isDarkMode
                        ? 'bg-[#bccc0f] text-black hover:bg-[#d4e512]'
                        : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
                      }
                    `}
                  >
                    {isFirst ? "Let\u2019s Go" : isLast ? 'Get Started' : 'Next'}
                  </motion.button>
                </div>
              </div>

              {/* Decorative grooves at bottom — vinyl style */}
              <div
                className="h-1.5 w-full"
                style={{
                  backgroundImage: `repeating-linear-gradient(
                    90deg,
                    ${isDarkMode ? 'rgba(188,204,15,0.15)' : 'rgba(122,138,11,0.15)'} 0px,
                    ${isDarkMode ? 'rgba(188,204,15,0.15)' : 'rgba(122,138,11,0.15)'} 2px,
                    transparent 2px,
                    transparent 6px
                  )`,
                }}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
