import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTools } from '../../hooks/useTools';
import ToolCard from './ToolCard';
import { AnimatePresence } from 'framer-motion';
import AddAppModal from '../Modals/AddAppModal';
import { Dialog } from '@headlessui/react';
import { useTheme } from '../../hooks/useTheme';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Confirmation Modal Component
function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Discard", 
  cancelText = "Cancel" 
}) {
  const { isDarkMode } = useTheme();

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose} 
      className="relative z-50"
    >
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
      
      {/* Modal positioning */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className={`
          w-full max-w-sm rounded-xl p-6 shadow-2xl backdrop-blur-sm
          ${isDarkMode 
            ? 'bg-gradient-to-br from-[#1a1a1a]/80 to-[#121212]/80 border border-[#bccc0f]/30' 
            : 'bg-gradient-to-br from-[#f5f5f5]/90 to-[#e0e0e0]/90 border border-black/10'
          }
        `}>
          <Dialog.Title className={`
            text-xl font-bold mb-4 
            ${isDarkMode ? 'text-[#bccc0f]' : 'text-black'}
          `}>
            {title}
          </Dialog.Title>

          <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {message}
          </p>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className={`
                px-4 py-2 rounded-lg transition-colors
                ${isDarkMode 
                  ? 'text-gray-300 hover:text-white' 
                  : 'text-gray-600 hover:text-black'
                }
              `}
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`
                px-6 py-2 rounded-lg transition-colors
                ${isDarkMode 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-red-500 text-white hover:bg-red-600'
                }
              `}
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function ToolGrid() {
  const { filteredTools, deleteApp, newlyAddedId } = useTools();
  const [editingTool, setEditingTool] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    tool: null
  });

  const handleEditClick = (tool) => {
    setEditingTool(tool);
  };

  const handleDeleteClick = (tool) => {
    // Show confirmation modal instead of immediate deletion
    setDeleteConfirmation({
      isOpen: true,
      tool: tool
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.tool) return;
    
    try {
      await deleteApp(deleteConfirmation.tool.id);
    } catch (error) {
      console.error("Failed to delete tool:", error);
      // Could add notification here for error handling
    }
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({
      isOpen: false,
      tool: null
    });
  };

  return (
    <>
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8 py-8 px-6"
        style={{ 
          borderRadius: '16px'
        }}
      >
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isNew={tool.id === newlyAddedId}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
          />
        ))}
      </motion.div>

      {/* Edit Tool Modal */}
      {editingTool && (
        <AddAppModal 
          onClose={() => setEditingTool(null)} 
          existingTool={editingTool} 
          isEditing={true}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
        onConfirm={confirmDelete}
        title="Delete Tool?"
        message={`Are you sure you want to delete ${deleteConfirmation.tool?.name || "this tool"}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
}

export default ToolGrid; 