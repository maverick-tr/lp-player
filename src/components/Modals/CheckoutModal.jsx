import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useTools } from '../../context/ToolContext';
import { useTheme } from '../../context/ThemeContext';

function CheckoutModal({ tool, onClose, onMaxUsage }) {
  const { isDarkMode } = useTheme();
  const [initials, setInitials] = useState('');
  const [error, setError] = useState('');
  const { checkoutTool } = useTools();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!initials.trim()) {
      setError('Please enter your initials');
      return;
    }

    try {
      await checkoutTool(tool.id, initials.toUpperCase());
      window.open(tool.url, '_blank');
      onClose();
    } catch (error) {
      if (error.message === 'Maximum checkouts reached') {
        onMaxUsage();
      } else {
        setError(error.message);
      }
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`
          w-full max-w-sm rounded-xl p-6 shadow-2xl
          ${isDarkMode 
            ? 'bg-gradient-to-br from-[#bccc0f]/20 to-tool-dark border border-[#bccc0f]/30' 
            : 'bg-white border border-black'
          }
        `}>
          <Dialog.Title className={`
            text-xl font-bold mb-4 
            ${isDarkMode ? 'text-[#bccc0f]' : 'text-black'}
          `}>
            Checkout {tool.name}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`
                block text-sm mb-2
                ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}
              `}>
                Enter your initials:
              </label>
              <input
                type="text"
                maxLength="3"
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                className={`
                  w-full px-3 py-2 rounded-lg border transition-colors
                  ${isDarkMode 
                    ? 'bg-tool-dark border-[#bccc0f]/30 text-white focus:border-[#bccc0f]' 
                    : 'bg-white border-gray-300 text-black focus:border-black'
                  }
                  focus:ring-1 focus:ring-opacity-50
                  ${isDarkMode ? 'focus:ring-[#bccc0f]' : 'focus:ring-black'}
                `}
              />
              {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className={`
                  px-4 py-2 rounded-lg transition-colors
                  ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-black'}
                `}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`
                  px-4 py-2 rounded-lg transition-colors
                  ${isDarkMode 
                    ? 'bg-[#bccc0f] text-black hover:bg-[#bccc0f]/90' 
                    : 'bg-black text-white hover:bg-gray-800'
                  }
                `}
              >
                Checkout
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default CheckoutModal; 