import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InstallStepItem from './InstallStepItem';

const PHASES = ['cloning', 'reading-readme', 'ai-analyzing', 'awaiting-approval', 'executing', 'registering', 'completed'];
const PHASE_LABELS = {
  'cloning': 'Clone',
  'reading-readme': 'Read',
  'ai-analyzing': 'Analyze',
  'awaiting-approval': 'Review',
  'executing': 'Install',
  'registering': 'Register',
  'completed': 'Done'
};

function InstallProgressPanel({ installState, installId, onAnswer, onCancel, isDarkMode }) {
  const { phase, plan, steps, question, error, phaseLiveOutput, postInstallNotes } = installState;
  const phaseOutputRef = useRef(null);

  const currentPhaseIndex = PHASES.indexOf(phase);
  const isFailed = phase === 'failed' || phase === 'cancelled';
  const isCompleted = phase === 'completed';

  // Auto-scroll phase live output
  useEffect(() => {
    if (phaseOutputRef.current) {
      phaseOutputRef.current.scrollTop = phaseOutputRef.current.scrollHeight;
    }
  }, [phaseLiveOutput]);

  return (
    <div className="space-y-4">
      {/* Phase Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PHASES.map((p, i) => {
          const isActive = i === currentPhaseIndex;
          const isDone = i < currentPhaseIndex || isCompleted;
          return (
            <div key={p} className="flex items-center gap-1 flex-shrink-0">
              <div className={`
                px-2 py-0.5 rounded-full text-xs font-medium transition-all
                ${isActive && !isFailed
                  ? (isDarkMode ? 'bg-[#bccc0f]/30 text-[#bccc0f]' : 'bg-[#7a8a0b]/20 text-[#4a5a06]')
                  : isDone
                    ? (isDarkMode ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700')
                    : (isDarkMode ? 'bg-gray-800 text-gray-600' : 'bg-gray-200 text-gray-400')
                }
              `}>
                {PHASE_LABELS[p]}
              </div>
              {i < PHASES.length - 1 && (
                <div className={`w-3 h-px ${isDone ? 'bg-green-500' : (isDarkMode ? 'bg-gray-700' : 'bg-gray-300')}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Cloning live output */}
      {phase === 'cloning' && (
        <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0"
              style={{ borderColor: isDarkMode ? '#bccc0f80' : '#7a8a0b', borderTopColor: 'transparent' }} />
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Cloning repository...
            </span>
          </div>
          {phaseLiveOutput && (
            <div
              ref={phaseOutputRef}
              className={`mt-2 rounded px-2 py-1.5 max-h-20 overflow-y-auto font-mono text-xs leading-relaxed ${
                isDarkMode ? 'bg-black/50 text-gray-500' : 'bg-white/80 text-gray-500'
              }`}
            >
              {phaseLiveOutput.trim().split('\n').slice(-10).map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-all">{line || '\u00A0'}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Thinking / Analyzing — uses shimmer-card effect */}
      {phase === 'ai-analyzing' && (
        <div className={`rounded-lg p-3 shimmer-card-loop ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 flex-shrink-0">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${isDarkMode ? 'bg-[#bccc0f]' : 'bg-[#7a8a0b]'}`}
                  animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              AI is thinking...
            </span>
          </div>
        </div>
      )}

      {/* Plan Review */}
      {phase === 'awaiting-approval' && plan && (
        <div className="space-y-3">
          <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-black/30' : 'bg-gray-100'}`}>
            <div className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-[#bccc0f]/80' : 'text-[#4a5a06]'}`}>
              Installation Plan — {plan.projectName}
            </div>
            <div className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {plan.description}
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {plan.language && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  {plan.language}
                </span>
              )}
              {plan.packageManager && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  {plan.packageManager}
                </span>
              )}
              {plan.port && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                  port:{plan.port}
                </span>
              )}
            </div>
            {plan.portConflictResolved && (
              <div className="text-xs text-yellow-500 mb-2">
                ⚠ {plan.portConflictResolved}
              </div>
            )}
            <div className="space-y-1">
              {plan.steps.map((step, i) => (
                <div key={i} className={`text-xs font-mono px-2 py-1 rounded ${
                  isDarkMode ? 'bg-black/40 text-gray-400' : 'bg-white text-gray-600'
                }`}>
                  <span className={isDarkMode ? 'text-gray-600' : 'text-gray-400'}>{i + 1}.</span> {step.label}
                  <div className={`ml-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>$ {step.command}</div>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Run command: <code className="font-mono">{plan.runCommand}</code>
            </div>
          </div>
        </div>
      )}

      {/* Executing: Step List */}
      {(phase === 'executing' || isCompleted || isFailed) && steps && steps.length > 0 && (
        <div className="space-y-1.5">
          {steps.map((step, i) => (
            <InstallStepItem key={i} step={step} isDarkMode={isDarkMode} />
          ))}
        </div>
      )}

      {/* Question Panel */}
      <AnimatePresence>
        {question && question.question !== '__PLAN_APPROVAL__' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-lg p-3 border ${
              isDarkMode
                ? 'bg-[#bccc0f]/5 border-[#bccc0f]/25'
                : 'bg-[#7a8a0b]/5 border-[#7a8a0b]/20'
            }`}
          >
            <p className={`text-sm mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              {question.question}
            </p>
            <div className="flex flex-wrap gap-2">
              {question.options?.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAnswer(question.questionId, opt)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    opt === question.default
                      ? (isDarkMode
                          ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                          : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]')
                      : (isDarkMode
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plan Approval Buttons */}
      {question && question.question === '__PLAN_APPROVAL__' && (
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={() => onAnswer(question.questionId, 'Cancel')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-black'
            }`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAnswer(question.questionId, 'Confirm & Install')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isDarkMode
                ? 'bg-[#bccc0f]/70 text-black hover:bg-[#bccc0f]/60'
                : 'bg-[#7a8a0b] text-white hover:bg-[#6b7a08]'
            }`}
          >
            Confirm & Install
          </button>
        </div>
      )}

      {/* Error Report */}
      {isFailed && error && (
        <div className={`rounded-lg p-3 border ${isDarkMode ? 'bg-red-900/20 border-red-900/40' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-red-400">Installation Failed</span>
            <div className="flex gap-2">
              {installId && (
                <button
                  type="button"
                  onClick={() => {
                    window.open(`${window.location.origin}/api/install/log/${installId}`, '_blank');
                  }}
                  className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-black'}`}
                >
                  Full Log
                </button>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(error)}
                className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-white' : 'bg-gray-200 text-gray-600 hover:text-black'}`}
              >
                Copy
              </button>
            </div>
          </div>
          <pre className="text-xs text-red-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto font-mono">
            {error}
          </pre>
        </div>
      )}

      {/* Completed */}
      {isCompleted && (
        <div className="space-y-3">
          <div className={`text-center py-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.div>
            <span className="text-sm font-medium">Project installed successfully!</span>
          </div>

          {/* Post-install notes */}
          {postInstallNotes && postInstallNotes.length > 0 && (
            <div className={`rounded-lg p-3 border ${
              isDarkMode ? 'bg-yellow-900/10 border-yellow-900/30' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                Post-install notes
              </div>
              <div className="space-y-1.5">
                {postInstallNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5 text-xs">
                      {note.type === 'skipped' ? (
                        <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>--</span>
                      ) : note.type === 'warning' ? (
                        <span className="text-yellow-500">!</span>
                      ) : (
                        <span className={isDarkMode ? 'text-blue-400' : 'text-blue-500'}>i</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${
                        note.type === 'reminder'
                          ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                          : (isDarkMode ? 'text-gray-300' : 'text-gray-600')
                      }`}>
                        {note.label}
                      </div>
                      {note.detail && note.type !== 'reminder' && (
                        <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                          {note.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cancel Button (during active phases) */}
      {!isCompleted && !isFailed && phase !== 'awaiting-approval' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              isDarkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'
            }`}
          >
            Cancel Installation
          </button>
        </div>
      )}
    </div>
  );
}

export default InstallProgressPanel;
