import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { SessionArtifactList } from './SessionArtifactList';
import type { SessionArtifact } from '../types';

const meta: Meta<typeof SessionArtifactList> = {
  title: 'BiChat/Components/SessionArtifactList',
  component: SessionArtifactList,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SessionArtifactList>

const now = new Date().toISOString();

const mockArtifacts: SessionArtifact[] = [
  {
    id: 'art-1',
    sessionId: 'session-1',
    type: 'chart',
    name: 'Revenue by Region Q4',
    description: 'Bar chart showing revenue breakdown',
    mimeType: 'application/json',
    sizeBytes: 4096,
    createdAt: now,
  },
  {
    id: 'art-2',
    sessionId: 'session-1',
    type: 'export',
    name: 'quarterly_report.xlsx',
    description: 'Full quarterly data export',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 184320,
    createdAt: now,
  },
  {
    id: 'art-3',
    sessionId: 'session-1',
    type: 'code_output',
    name: 'analysis_output.txt',
    mimeType: 'text/plain',
    sizeBytes: 2048,
    createdAt: now,
  },
  {
    id: 'art-4',
    sessionId: 'session-1',
    type: 'attachment',
    name: 'dashboard_screenshot.png',
    mimeType: 'image/png',
    url: 'https://placehold.co/400x300/e2e8f0/64748b?text=Chart',
    sizeBytes: 52000,
    createdAt: now,
  },
];

export const Playground: Story = {
  args: {
    artifacts: mockArtifacts,
    onSelect: fn(),
  },
};

export const Empty: Story = {
  args: {
    artifacts: [],
    onSelect: fn(),
  },
};
