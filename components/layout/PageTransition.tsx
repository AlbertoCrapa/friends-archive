'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: React.ReactNode;
}

// ease-out-quint — fast start, long gentle settle
const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const;

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{
          duration: 0.42,
          ease: EASE_OUT_QUINT,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
