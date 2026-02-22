import type { Meta, StoryObj } from '@storybook/react';

import { ActivityTrace } from './ActivityTrace';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';
import {
  makeActivityStep,
  makeActivitySteps,
  makeAgentActivitySteps,
} from '@sb-helpers/bichatFixtures';

const meta: Meta<typeof ActivityTrace> = {
  title: 'BiChat/Components/ActivityTrace',
  component: ActivityTrace,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ActivityTrace>

// ---------------------------------------------------------------------------
// 1. Playground — basic usage with thinking content and a few steps
// ---------------------------------------------------------------------------

export const Playground: Story = {
  args: {
    thinkingContent:
      'Let me analyze the revenue data for Q4...\nLooking at the regional breakdown now.',
    activeSteps: makeActivitySteps(),
  },
};

// ---------------------------------------------------------------------------
// 2. ThinkingOnly — only thinking content, no steps
// ---------------------------------------------------------------------------

export const ThinkingOnly: Story = {
  args: {
    thinkingContent:
      'Reasoning through the problem step by step. First I need to understand the data schema and then decide on the appropriate aggregation strategy.',
    activeSteps: [],
  },
};

// ---------------------------------------------------------------------------
// 3. StepsOnly — only activity steps, no thinking
// ---------------------------------------------------------------------------

export const StepsOnly: Story = {
  args: {
    thinkingContent: '',
    activeSteps: makeActivitySteps(),
  },
};

// ---------------------------------------------------------------------------
// 4. WithSubAgents — nested agent groups via makeAgentActivitySteps
// ---------------------------------------------------------------------------

export const WithSubAgents: Story = {
  args: {
    thinkingContent: 'Delegating analysis to specialized agents...',
    activeSteps: makeAgentActivitySteps(),
  },
};

// ---------------------------------------------------------------------------
// 5. AllCompleted — every step is completed with durations
// ---------------------------------------------------------------------------

const now = Date.now();

export const AllCompleted: Story = {
  args: {
    thinkingContent: '',
    activeSteps: [
      makeActivityStep({
        id: 'done-1',
        type: 'tool',
        toolName: 'query_database',
        status: 'completed',
        startedAt: now - 5000,
        completedAt: now - 3800,
        durationMs: 1200,
      }),
      makeActivityStep({
        id: 'done-2',
        type: 'tool',
        toolName: 'run_code',
        arguments: JSON.stringify({ language: 'python' }),
        status: 'completed',
        startedAt: now - 3800,
        completedAt: now - 2400,
        durationMs: 1400,
      }),
      makeActivityStep({
        id: 'done-3',
        type: 'tool',
        toolName: 'generate_chart',
        status: 'completed',
        startedAt: now - 2400,
        completedAt: now - 2100,
        durationMs: 300,
      }),
      makeActivityStep({
        id: 'done-4',
        type: 'agent_delegation',
        toolName: 'delegate_task',
        agentName: 'Data Analyst',
        status: 'completed',
        startedAt: now - 2100,
        completedAt: now - 1500,
        durationMs: 600,
      }),
    ],
  },
};

// ---------------------------------------------------------------------------
// 6. Stress — ScenarioGrid showing multiple variants at once
// ---------------------------------------------------------------------------

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Thinking only',
          description: 'No tool steps, just reasoning text',
          content: (
            <ActivityTrace
              thinkingContent="Analyzing the quarterly revenue trends across all business units..."
              activeSteps={[]}
            />
          ),
        },
        {
          name: 'Steps only',
          description: 'Tool steps without thinking content',
          content: (
            <ActivityTrace thinkingContent="" activeSteps={makeActivitySteps()} />
          ),
        },
        {
          name: 'Thinking + Steps',
          description: 'Both thinking content and tool steps active',
          content: (
            <ActivityTrace
              thinkingContent="Let me query the database and generate a chart..."
              activeSteps={makeActivitySteps()}
            />
          ),
        },
        {
          name: 'Sub-agent groups',
          description: 'Steps delegated to named sub-agents',
          content: (
            <ActivityTrace
              thinkingContent="Delegating to specialists..."
              activeSteps={makeAgentActivitySteps()}
            />
          ),
        },
        {
          name: 'All completed',
          description: 'Every step finished with durations',
          content: (
            <ActivityTrace
              thinkingContent=""
              activeSteps={[
                makeActivityStep({
                  id: 'stress-1',
                  toolName: 'query_database',
                  status: 'completed',
                  durationMs: 1200,
                }),
                makeActivityStep({
                  id: 'stress-2',
                  toolName: 'run_code',
                  status: 'completed',
                  durationMs: 850,
                }),
                makeActivityStep({
                  id: 'stress-3',
                  toolName: 'generate_chart',
                  status: 'completed',
                  durationMs: 300,
                }),
              ]}
            />
          ),
        },
        {
          name: 'Custom tool label prefix',
          description: 'toolLabelPrefix set to "Ali.Tools"',
          content: (
            <ActivityTrace
              thinkingContent=""
              activeSteps={makeActivitySteps()}
              toolLabelPrefix="Ali.Tools"
            />
          ),
        },
      ]}
    />
  ),
};
