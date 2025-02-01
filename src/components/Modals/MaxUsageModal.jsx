import { Dialog } from '@headlessui/react';

function MaxUsageModal({ onClose }) {
  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-tool-light rounded-lg p-6 max-w-sm w-full">
          <Dialog.Title className="text-xl font-bold text-red-400 mb-4">
            Maximum Usage Reached
          </Dialog.Title>
          
          <p className="text-gray-300 mb-4">
            This tool has reached its maximum number of checkouts. Please try again later when someone checks it back in.
          </p>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-tool-accent text-tool-darker rounded-md hover:bg-tool-accent/90"
          >
            Close
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default MaxUsageModal; 