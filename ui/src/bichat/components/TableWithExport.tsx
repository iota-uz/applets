/**
 * TableWithExport Component
 * Wraps markdown tables with an export button that sends a message to export the table
 */

import { memo, useCallback, type ReactNode } from 'react';
import { TableExportButton } from './TableExportButton';
import { useTranslation } from '../hooks/useTranslation';

interface TableWithExportProps {
  /** The table content to render */
  children: ReactNode
  /** Function to send a message (from chat context) */
  sendMessage?: (content: string) => void
  /** Whether sending is disabled (loading or streaming) */
  disabled?: boolean
  /** Custom export message to send */
  exportMessage?: string
  /** Export button label */
  exportLabel?: string
}

export const TableWithExport = memo(function TableWithExport({
  children,
  sendMessage,
  disabled = false,
  exportMessage,
  exportLabel,
}: TableWithExportProps) {
  const { t } = useTranslation();
  const resolvedExportMessage = exportMessage ?? t('BiChat.ExportTableToExcel');
  const resolvedExportLabel = exportLabel ?? t('BiChat.Export');
  const handleExport = useCallback(() => {
    sendMessage?.(resolvedExportMessage);
  }, [sendMessage, resolvedExportMessage]);

  return (
    <>
      <div className="markdown-table-wrapper overflow-x-auto">
        <table className="markdown-table w-full border-collapse">{children}</table>
      </div>
      {sendMessage && (
        <div className="flex justify-end mt-1">
          <TableExportButton onClick={handleExport} disabled={disabled} label={resolvedExportLabel} />
        </div>
      )}
    </>
  );
});
