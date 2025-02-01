import { AnimatePresence, motion } from 'framer-motion';

export const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.2 }
};

export function FadeIn({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={fadeIn}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedList({ children }) {
  return (
    <AnimatePresence mode="sync">
      {children}
    </AnimatePresence>
  );
} 