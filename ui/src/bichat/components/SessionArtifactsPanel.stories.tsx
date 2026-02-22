import type { Meta, StoryObj } from '@storybook/react';

import { SessionArtifactsPanel } from './SessionArtifactsPanel';
import { MockChatDataSource } from '@sb-helpers/mockChatDataSource';
import type { ChatDataSource, SessionArtifact } from '../types';

const meta: Meta<typeof SessionArtifactsPanel> = {
  title: 'BiChat/Components/SessionArtifactsPanel',
  component: SessionArtifactsPanel,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-[600px] flex">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SessionArtifactsPanel>

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
];

function makeDataSourceWithArtifacts(artifacts: SessionArtifact[]): ChatDataSource {
  const base = new MockChatDataSource();
  return {
    ...base,
    createSession: base.createSession.bind(base),
    fetchSession: base.fetchSession.bind(base),
    sendMessage: base.sendMessage.bind(base),
    clearSessionHistory: base.clearSessionHistory.bind(base),
    compactSessionHistory: base.compactSessionHistory.bind(base),
    submitQuestionAnswers: base.submitQuestionAnswers.bind(base),
    rejectPendingQuestion: base.rejectPendingQuestion.bind(base),
    listSessions: base.listSessions.bind(base),
    archiveSession: base.archiveSession.bind(base),
    unarchiveSession: base.unarchiveSession.bind(base),
    pinSession: base.pinSession.bind(base),
    unpinSession: base.unpinSession.bind(base),
    deleteSession: base.deleteSession.bind(base),
    renameSession: base.renameSession.bind(base),
    regenerateSessionTitle: base.regenerateSessionTitle.bind(base),
    fetchSessionArtifacts: async () => ({
      artifacts,
      hasMore: false,
    }),
  };
}

function makeLoadingDataSource(): ChatDataSource {
  const base = new MockChatDataSource();
  return {
    ...base,
    createSession: base.createSession.bind(base),
    fetchSession: base.fetchSession.bind(base),
    sendMessage: base.sendMessage.bind(base),
    clearSessionHistory: base.clearSessionHistory.bind(base),
    compactSessionHistory: base.compactSessionHistory.bind(base),
    submitQuestionAnswers: base.submitQuestionAnswers.bind(base),
    rejectPendingQuestion: base.rejectPendingQuestion.bind(base),
    listSessions: base.listSessions.bind(base),
    archiveSession: base.archiveSession.bind(base),
    unarchiveSession: base.unarchiveSession.bind(base),
    pinSession: base.pinSession.bind(base),
    unpinSession: base.unpinSession.bind(base),
    deleteSession: base.deleteSession.bind(base),
    renameSession: base.renameSession.bind(base),
    regenerateSessionTitle: base.regenerateSessionTitle.bind(base),
    fetchSessionArtifacts: () => new Promise(() => {}), // never resolves
  };
}

export const Playground: Story = {
  args: {
    dataSource: makeDataSourceWithArtifacts(mockArtifacts),
    sessionId: 'session-1',
    isStreaming: false,
    artifactsInvalidationTrigger: 0,
  },
};

export const Empty: Story = {
  args: {
    dataSource: makeDataSourceWithArtifacts([]),
    sessionId: 'session-1',
    isStreaming: false,
    artifactsInvalidationTrigger: 0,
  },
};

export const Loading: Story = {
  args: {
    dataSource: makeLoadingDataSource(),
    sessionId: 'session-1',
    isStreaming: false,
    artifactsInvalidationTrigger: 0,
  },
};
