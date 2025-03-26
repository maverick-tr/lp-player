import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTools } from '../../hooks/useTools';
import ToolCard from './ToolCard';
import { AnimatePresence } from 'framer-motion';
import AddAppModal from '../Modals/AddAppModal';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

function ToolGrid() {
  const { filteredTools } = useTools();
  const [editingTool, setEditingTool] = useState(null);

  const handleEditClick = (tool) => {
    setEditingTool(tool);
  };

  return (
    <>
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-8"
      >
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            onEditClick={handleEditClick}
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
    </>
  );
}

export default ToolGrid; 