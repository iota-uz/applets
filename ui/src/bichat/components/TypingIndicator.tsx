/**
 * TypingIndicator Component
 * Displays rotating verbs with shimmer animation to show AI is thinking/processing.
 * Verbs are configurable via props. When not provided, defaults are pulled from translations.
 */

import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { verbTransitionVariants } from '../animations/variants';
import { useTranslation } from '../hooks/useTranslation';

export interface TypingIndicatorProps {
  /** Custom thinking verbs to rotate through */
  verbs?: string[]
  /** Verb rotation interval in ms (defaults to 3000) */
  rotationInterval?: number
  /** Additional CSS classes */
  className?: string
}

// Translation keys for default thinking verbs
const THINKING_KEYS = [
  'BiChat.Thinking.Thinking',
  'BiChat.Thinking.Processing',
  'BiChat.Thinking.Analyzing',
  'BiChat.Thinking.Synthesizing',
  'BiChat.Thinking.Computing',
  'BiChat.Thinking.WorkingOnIt',
];

// Check if user prefers reduced motion
const prefersReducedMotion = () => {
  if (typeof window === 'undefined') {return false;}
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Random selector without immediate repeat
const getRandomVerb = (verbs: string[], current: string): string => {
  const available = verbs.filter((v) => v !== current);
  if (available.length === 0) {
    return current || verbs[0] || '';
  }
  return available[Math.floor(Math.random() * available.length)];
};

function TypingIndicator({
  verbs: verbsProp,
  rotationInterval = 3000,
  className = '',
}: TypingIndicatorProps) {
  const { t } = useTranslation();

  const verbs = useMemo(() => {
    if (verbsProp) {return verbsProp;}
    return THINKING_KEYS.map((key) => t(key));
  }, [verbsProp, t]);

  const [verb, setVerb] = useState(() => verbs[Math.floor(Math.random() * verbs.length)]);

  useEffect(() => {
    if (prefersReducedMotion()) {return;}

    const interval = setInterval(() => {
      setVerb((prev) => getRandomVerb(verbs, prev));
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [verbs, rotationInterval]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2.5 text-gray-500 dark:text-gray-400 ${className}`}
    >
      <div className="flex items-center gap-1" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce motion-reduce:animate-none [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce motion-reduce:animate-none [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce motion-reduce:animate-none [animation-delay:300ms]" />
      </div>
      <div className="overflow-hidden h-6 relative">
        <AnimatePresence mode="wait">
          <motion.span
            key={verb}
            variants={verbTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-sm bichat-thinking-shimmer block"
            aria-label={t('BiChat.Thinking.AriaLabel', { verb })}
          >
            {verb}...
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

const MemoizedTypingIndicator = memo(TypingIndicator);
MemoizedTypingIndicator.displayName = 'TypingIndicator';

export { MemoizedTypingIndicator as TypingIndicator };
export default MemoizedTypingIndicator;
