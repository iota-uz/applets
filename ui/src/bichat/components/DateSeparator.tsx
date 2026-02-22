/**
 * DateSeparator Component
 * Renders a centered date label with horizontal divider lines.
 * Shows "Today", "Yesterday", or a formatted date for older messages.
 */

import { useMemo } from 'react';
import { isToday, isYesterday, format } from 'date-fns';
import { useTranslation } from '../hooks/useTranslation';

interface DateSeparatorProps {
  date: Date
}

export function DateSeparator({ date }: DateSeparatorProps) {
  const { t } = useTranslation();

  const label = useMemo(() => {
    if (isToday(date)) {return t('BiChat.DateGroup.Today');}
    if (isYesterday(date)) {return t('BiChat.DateGroup.Yesterday');}
    return format(date, 'MMM d');
  }, [date, t]);

  return (
    <div className="flex items-center gap-3 py-2 select-none" aria-label={label}>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

export default DateSeparator;
