/**
 * Combined story for DataTable internal sub-components:
 * DataTableCell, DataTableToolbar, DataTableStatsBar
 *
 * These are internal building blocks of InteractiveTableCard. They are
 * showcased here for visual reference and isolated testing.
 */
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { DataTableCell } from './DataTableCell';
import { DataTableToolbar } from './DataTableToolbar';
import { DataTableStatsBar } from './DataTableStatsBar';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';
import type { ColumnMeta, ColumnStats } from '../hooks/useDataTable';

const meta: Meta = {
  title: 'BiChat/Components/DataTable Internals',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj

// Shared mock data
const columns: ColumnMeta[] = [
  { index: 0, name: 'region', header: 'Region', type: 'string', visible: true, width: 120 },
  { index: 1, name: 'revenue', header: 'Revenue ($)', type: 'number', visible: true, width: 120 },
  { index: 2, name: 'growth', header: 'Growth (%)', type: 'number', visible: true, width: 100 },
  { index: 3, name: 'hidden', header: 'Hidden Col', type: 'string', visible: false, width: 100 },
];

const stats = new Map<number, ColumnStats>([
  [1, { sum: 4_800_000, avg: 960_000, min: 310_000, max: 1_850_000, count: 5, nullCount: 0 }],
  [2, { sum: 94.2, avg: 18.84, min: 8.4, max: 31.0, count: 5, nullCount: 0 }],
]);

export const Cell: Story = {
  render: () => (
    <ScenarioGrid
      columns={3}
      scenarios={[
        {
          name: 'Text cell (left-aligned)',
          content: (
            <table><tbody><tr>
              <DataTableCell formatted={{ display: 'EMEA', raw: 'EMEA', type: 'string', isNull: false }} alignment="left" onCopy={fn()} />
            </tr></tbody></table>
          ),
        },
        {
          name: 'Number cell (right-aligned)',
          content: (
            <table><tbody><tr>
              <DataTableCell formatted={{ display: '$1,240,000', raw: 1240000, type: 'number', isNull: false }} alignment="right" onCopy={fn()} />
            </tr></tbody></table>
          ),
        },
        {
          name: 'Null cell',
          content: (
            <table><tbody><tr>
              <DataTableCell formatted={{ display: 'NULL', raw: null, type: 'string', isNull: true }} alignment="left" />
            </tr></tbody></table>
          ),
        },
      ]}
    />
  ),
};

export const Toolbar: Story = {
  render: () => (
    <div className="w-[500px]">
      <DataTableToolbar
        columns={columns}
        searchQuery=""
        onSearchChange={fn()}
        onToggleColumnVisibility={fn()}
        onResetColumnVisibility={fn()}
        hasHiddenColumns={true}
      />
    </div>
  ),
};

export const ToolbarWithSearch: Story = {
  render: () => (
    <div className="w-[500px]">
      <DataTableToolbar
        columns={columns}
        searchQuery="EMEA"
        onSearchChange={fn()}
        onToggleColumnVisibility={fn()}
        onResetColumnVisibility={fn()}
        hasHiddenColumns={false}
      />
    </div>
  ),
};

export const StatsBar: Story = {
  render: () => (
    <div className="w-[500px]">
      <DataTableStatsBar columns={columns.filter((c) => c.visible)} stats={stats} />
    </div>
  ),
};

export const StatsBarEmpty: Story = {
  render: () => (
    <div className="w-[500px]">
      <DataTableStatsBar columns={columns.filter((c) => c.visible)} stats={new Map()} />
    </div>
  ),
};
