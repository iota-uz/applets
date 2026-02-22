import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { InteractiveTableCard } from './InteractiveTableCard';
import { makeRenderTableData } from '@sb-helpers/bichatFixtures';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof InteractiveTableCard> = {
  title: 'BiChat/Components/InteractiveTableCard',
  component: InteractiveTableCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof InteractiveTableCard>

// ---------------------------------------------------------------------------
// 1. Playground
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    table: makeRenderTableData(),
    onSendMessage: fn(),
    sendDisabled: false,
  },
  argTypes: {
    sendDisabled: { control: 'boolean' },
  },
};

// ---------------------------------------------------------------------------
// 2. WithExportUrl
// ---------------------------------------------------------------------------

export const WithExportUrl: Story = {
  args: {
    table: makeRenderTableData({
      export: { url: '#', filename: 'export.xlsx', rowCount: 100 },
    }),
    onSendMessage: fn(),
  },
};

// ---------------------------------------------------------------------------
// 3. WithExportPrompt
// ---------------------------------------------------------------------------

export const WithExportPrompt: Story = {
  args: {
    table: makeRenderTableData({
      exportPrompt: 'Export the full table',
    }),
    onSendMessage: fn(),
  },
};

// ---------------------------------------------------------------------------
// 4. WideTable — 15 columns to test horizontal scroll
// ---------------------------------------------------------------------------

const wideColumns = Array.from({ length: 15 }, (_, i) => `col${i + 1}`);
const wideHeaders = Array.from({ length: 15 }, (_, i) => `Column ${i + 1}`);
const wideColumnTypes = Array.from({ length: 15 }, () => 'string');
const wideRows = Array.from({ length: 5 }, (_, r) =>
  Array.from({ length: 15 }, (_, c) => `R${r + 1}C${c + 1}`),
);

export const WideTable: Story = {
  args: {
    table: makeRenderTableData({
      id: 'wide-table',
      title: 'Wide Table (15 columns)',
      query: 'SELECT col1, col2, ... col15 FROM wide_data',
      columns: wideColumns,
      columnTypes: wideColumnTypes,
      headers: wideHeaders,
      rows: wideRows,
      totalRows: 5,
    }),
    onSendMessage: fn(),
  },
};

// ---------------------------------------------------------------------------
// 5. Truncated — 20 rows, marked as truncated from 500
// ---------------------------------------------------------------------------

const truncatedRows = Array.from({ length: 20 }, (_, r) => [
  `Region-${r + 1}`,
  Math.round(Math.random() * 2_000_000),
  +(Math.random() * 40).toFixed(1),
  Math.round(Math.random() * 5000),
  Math.round(Math.random() * 400),
]);

export const Truncated: Story = {
  args: {
    table: makeRenderTableData({
      id: 'truncated-table',
      truncated: true,
      totalRows: 500,
      pageSize: 20,
      rows: truncatedRows,
    }),
    onSendMessage: fn(),
  },
};

// ---------------------------------------------------------------------------
// 6. Stress — ScenarioGrid
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      scenarios={[
        {
          name: 'Default',
          description: 'Standard 5-row table with all defaults',
          content: (
            <InteractiveTableCard
              table={makeRenderTableData()}
              onSendMessage={fn()}
            />
          ),
        },
        {
          name: 'Wide (15 cols)',
          description: 'Horizontal scroll stress test',
          content: (
            <InteractiveTableCard
              table={makeRenderTableData({
                id: 'stress-wide',
                title: 'Wide Table',
                query: 'SELECT * FROM wide',
                columns: wideColumns,
                columnTypes: wideColumnTypes,
                headers: wideHeaders,
                rows: wideRows,
                totalRows: 5,
              })}
              onSendMessage={fn()}
            />
          ),
        },
        {
          name: 'Truncated',
          description: 'Shows truncation banner at the bottom',
          content: (
            <InteractiveTableCard
              table={makeRenderTableData({
                id: 'stress-truncated',
                truncated: true,
                totalRows: 500,
                pageSize: 20,
                rows: truncatedRows,
              })}
              onSendMessage={fn()}
            />
          ),
        },
        {
          name: 'No Title',
          description: 'Falls back to default "Query Results" heading',
          content: (
            <InteractiveTableCard
              table={makeRenderTableData({
                id: 'stress-no-title',
                title: undefined,
              })}
              onSendMessage={fn()}
            />
          ),
        },
        {
          name: 'With Export URL',
          description: 'Export button links to a download URL',
          content: (
            <InteractiveTableCard
              table={makeRenderTableData({
                id: 'stress-export',
                export: { url: '#', filename: 'report.xlsx', rowCount: 250 },
              })}
              onSendMessage={fn()}
            />
          ),
        },
      ]}
    />
  ),
};
