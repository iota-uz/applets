import { motion } from 'framer-motion'

interface CompactionDoodleProps {
  title: string
  subtitle: string
}

export function CompactionDoodle({ title, subtitle }: CompactionDoodleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="flex items-center gap-2.5 rounded-xl border border-gray-200/70 bg-white/95 px-3.5 py-2 shadow-sm backdrop-blur-sm dark:border-gray-700/50 dark:bg-gray-800/95"
    >
      <div className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400/30" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{title}</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</span>
      </div>
    </motion.div>
  )
}

export default CompactionDoodle
