import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function InstallStepItem({ step, isDarkMode }) {
  const [expanded, setExpanded] = useState(step.status === 'failed');
  const liveOutputRef = useRef(null);

  // Auto-expand when a step fails
  useEffect(() => {
    if (step.status === 'failed') setExpanded(true);
  }, [step.status]);

  // Auto-scroll live output to bottom
  useEffect(() => {
    if (liveOutputRef.current) {
      liveOutputRef.current.scrollTop = liveOutputRef.current.scrollHeight;
    }
  }, [step.liveOutput]);

  const statusIcon = {
    pending: (
      <span className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
    ),
    running: (
      <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: isDarkMode ? '#bccc0f80' : '#7a8a0b', borderTopColor: 'transparent' }} />
    ),
    completed: (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    failed: (
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z" />
      </svg>
    ),
    skipped: (
      <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>—</span>
    )
  };

  const duration = step.startedAt && step.completedAt
    ? ((step.completedAt - step.startedAt) / 1000).toFixed(1) + 's'
    : null;

  const isRunning = step.status === 'running';
  const hasLiveOutput = isRunning && step.liveOutput;
  const hasOutput = step.output && step.output.trim();
  const showToggle = hasOutput && !isRunning;

  return (
    <div className={`rounded-lg overflow-hidden ${
      isDarkMode ? 'bg-black/30' : 'bg-gray-100'
    }`}>
      <button
        type="button"
        onClick={() => showToggle && setExpanded(!expanded)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm ${
          showToggle ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {statusIcon[step.status] || statusIcon.pending}
        </span>
        <span className={`flex-1 truncate ${
          step.status === 'running'
            ? (isDarkMode ? 'text-white' : 'text-black')
            : step.status === 'completed'
              ? (isDarkMode ? 'text-gray-400' : 'text-gray-500')
              : step.status === 'failed'
                ? 'text-red-400'
                : step.status === 'skipped'
                  ? (isDarkMode ? 'text-gray-600 line-through' : 'text-gray-400 line-through')
                  : (isDarkMode ? 'text-gray-500' : 'text-gray-400')
        }`}>
          {step.label}
          {step.status === 'skipped' && (
            <span className={`ml-2 no-underline text-xs ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>skipped</span>
          )}
        </span>
        {duration && (
          <span className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            {duration}
          </span>
        )}
        {showToggle && (
          <span className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            {expanded ? '▾' : '▸'}
          </span>
        )}
      </button>

      {/* Live output while running */}
      {hasLiveOutput && (
        <div
          ref={liveOutputRef}
          className={`mx-3 mb-2 rounded px-2 py-1.5 max-h-28 overflow-y-auto font-mono text-xs leading-relaxed ${
            isDarkMode ? 'bg-black/50 text-gray-500' : 'bg-white/80 text-gray-500'
          }`}
        >
          {step.liveOutput.trim().split('\n').slice(-30).map((line, idx) => (
            <div key={idx} className="whitespace-pre-wrap break-all">{line || '\u00A0'}</div>
          ))}
        </div>
      )}

      {/* Collapsed output for completed/failed steps */}
      <AnimatePresence>
        {expanded && hasOutput && !isRunning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <pre className={`px-3 pb-2 text-xs whitespace-pre-wrap break-all overflow-y-auto font-mono ${
              step.status === 'failed' ? 'max-h-48' : 'max-h-32'
            } ${
              isDarkMode ? 'text-gray-500' : 'text-gray-500'
            }`}>
              {step.output.trim()}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default InstallStepItem;
