import { motion } from 'framer-motion';
import { useState } from 'react';
import { useTools } from '../../context/ToolContext';
import ToolCard from './ToolCard';
import CheckoutModal from '../Modals/CheckoutModal';
import MaxUsageModal from '../Modals/MaxUsageModal';
import { AnimatePresence } from 'framer-motion';

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
  const [selectedTool, setSelectedTool] = useState(null);
  const [showMaxUsageModal, setShowMaxUsageModal] = useState(false);

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
            onCheckout={() => setSelectedTool(tool)}
          />
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedTool && (
          <CheckoutModal
            tool={selectedTool}
            onClose={() => setSelectedTool(null)}
            onMaxUsage={() => {
              setSelectedTool(null);
              setShowMaxUsageModal(true);
            }}
          />
        )}

        {showMaxUsageModal && (
          <MaxUsageModal
            onClose={() => setShowMaxUsageModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default ToolGrid; 