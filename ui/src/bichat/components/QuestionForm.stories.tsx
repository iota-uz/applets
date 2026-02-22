import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import QuestionForm from './QuestionForm';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';
import { makePendingQuestion } from '@sb-helpers/bichatFixtures';
import type { Question } from '../types';

const meta: Meta<typeof QuestionForm> = {
  title: 'BiChat/Components/QuestionForm',
  component: QuestionForm,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof QuestionForm>

// ---------------------------------------------------------------------------
// Shared question fixtures
// ---------------------------------------------------------------------------

const regionQuestion: Question = {
  id: 'q-region',
  text: 'Which regions should the report cover?',
  type: 'MULTIPLE_CHOICE',
  required: true,
  options: [
    { id: 'o-emea', label: 'EMEA', value: 'EMEA' },
    { id: 'o-apac', label: 'APAC', value: 'APAC' },
    { id: 'o-amer', label: 'Americas', value: 'AMER' },
  ],
};

const dateRangeQuestion: Question = {
  id: 'q-date',
  text: 'What date range should we analyze?',
  type: 'SINGLE_CHOICE',
  required: true,
  options: [
    { id: 'o-7d', label: 'Last 7 days', value: '7d' },
    { id: 'o-30d', label: 'Last 30 days', value: '30d' },
    { id: 'o-90d', label: 'Last 90 days', value: '90d' },
    { id: 'o-ytd', label: 'Year to date', value: 'ytd' },
  ],
};

const formatQuestion: Question = {
  id: 'q-format',
  text: 'Choose the output format',
  type: 'SINGLE_CHOICE',
  required: true,
  options: [
    { id: 'o-table', label: 'Data table', value: 'table' },
    { id: 'o-chart', label: 'Chart', value: 'chart' },
    { id: 'o-both', label: 'Table + Chart', value: 'both' },
  ],
};

const singleChoiceQuestion: Question = {
  id: 'q-metric',
  text: 'Which metric do you want to focus on?',
  type: 'SINGLE_CHOICE',
  required: true,
  options: [
    { id: 'o-rev', label: 'Revenue', value: 'revenue' },
    { id: 'o-margin', label: 'Gross Margin', value: 'margin' },
    { id: 'o-orders', label: 'Order Count', value: 'orders' },
    { id: 'o-aov', label: 'Average Order Value', value: 'aov' },
  ],
};

const optionalQuestion1: Question = {
  id: 'q-opt-notes',
  text: 'Any additional notes for the report? (optional)',
  type: 'SINGLE_CHOICE',
  required: false,
  options: [
    { id: 'o-exec', label: 'Include executive summary', value: 'exec' },
    { id: 'o-detail', label: 'Include detailed breakdown', value: 'detail' },
    { id: 'o-none', label: 'No extras', value: 'none' },
  ],
};

const optionalQuestion2: Question = {
  id: 'q-opt-recipients',
  text: 'Who should receive a copy? (optional)',
  type: 'MULTIPLE_CHOICE',
  required: false,
  options: [
    { id: 'o-mgmt', label: 'Management', value: 'management' },
    { id: 'o-sales', label: 'Sales team', value: 'sales' },
    { id: 'o-finance', label: 'Finance', value: 'finance' },
  ],
};

const longOptionsQuestion: Question = {
  id: 'q-department',
  text: 'Select the departments to include in the cross-functional analysis',
  type: 'MULTIPLE_CHOICE',
  required: true,
  options: [
    { id: 'o-eng', label: 'Engineering', value: 'engineering' },
    { id: 'o-product', label: 'Product Management', value: 'product' },
    { id: 'o-design', label: 'Design & UX', value: 'design' },
    { id: 'o-marketing', label: 'Marketing', value: 'marketing' },
    { id: 'o-sales', label: 'Sales', value: 'sales' },
    { id: 'o-cs', label: 'Customer Success', value: 'customer_success' },
    { id: 'o-hr', label: 'Human Resources', value: 'hr' },
    { id: 'o-finance', label: 'Finance & Accounting', value: 'finance' },
    { id: 'o-legal', label: 'Legal & Compliance', value: 'legal' },
    { id: 'o-ops', label: 'Operations', value: 'operations' },
  ],
};

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * Single question from the default fixture. Use the controls panel to
 * change the sessionId.
 */
export const Playground: Story = {
  args: {
    pendingQuestion: makePendingQuestion(),
    sessionId: 'session-1',
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    onCancel: fn(),
  },
};

/**
 * Multi-step wizard with 3 questions: region selection (MULTIPLE_CHOICE),
 * date range (SINGLE_CHOICE), and output format (SINGLE_CHOICE).
 * Click "Next" after selecting options to walk through the progress bar
 * and reach the confirmation step.
 */
export const MultiStep: Story = {
  args: {
    pendingQuestion: makePendingQuestion({
      questions: [regionQuestion, dateRangeQuestion, formatQuestion],
    }),
    sessionId: 'session-multi',
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    onCancel: fn(),
  },
};

/**
 * A single SINGLE_CHOICE question. Only one option can be selected at a
 * time; radio-button semantics apply.
 */
export const SingleChoice: Story = {
  args: {
    pendingQuestion: makePendingQuestion({
      questions: [singleChoiceQuestion],
    }),
    sessionId: 'session-single',
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    onCancel: fn(),
  },
};

/**
 * Two questions with `required: false`. The "Next" button should be
 * enabled even when nothing is selected, allowing the user to skip.
 */
export const OptionalQuestions: Story = {
  args: {
    pendingQuestion: makePendingQuestion({
      questions: [optionalQuestion1, optionalQuestion2],
    }),
    sessionId: 'session-optional',
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    onCancel: fn(),
  },
};

/**
 * A question with 10 options to verify the list scrolls / wraps properly
 * inside the modal without clipping.
 */
export const LongOptions: Story = {
  args: {
    pendingQuestion: makePendingQuestion({
      questions: [longOptionsQuestion],
    }),
    sessionId: 'session-long',
    onSubmit: fn().mockImplementation(() => Promise.resolve()),
    onCancel: fn(),
  },
};

/**
 * ScenarioGrid showing all major variants side-by-side for quick visual
 * regression testing. Each cell renders QuestionForm inside a relative
 * container so the fixed overlay stays scoped.
 */
export const Stress: Story = {
  render: () => {
    const noop = () => {};
    const noopAsync = () => Promise.resolve();

    return (
      <ScenarioGrid
        columns={1}
        scenarios={[
          {
            name: 'Single Question',
            description: 'Default fixture — one MULTIPLE_CHOICE question',
            content: (
              <div className="relative h-[500px] overflow-hidden">
                <QuestionForm
                  pendingQuestion={makePendingQuestion()}
                  sessionId="stress-single"
                  onSubmit={noopAsync}
                  onCancel={noop}
                />
              </div>
            ),
          },
          {
            name: 'Multi-Step (3 questions)',
            description: 'Region, date range, and format — wizard navigation',
            content: (
              <div className="relative h-[500px] overflow-hidden">
                <QuestionForm
                  pendingQuestion={makePendingQuestion({
                    questions: [regionQuestion, dateRangeQuestion, formatQuestion],
                  })}
                  sessionId="stress-multi"
                  onSubmit={noopAsync}
                  onCancel={noop}
                />
              </div>
            ),
          },
          {
            name: 'Single Choice',
            description: 'SINGLE_CHOICE with radio semantics',
            content: (
              <div className="relative h-[500px] overflow-hidden">
                <QuestionForm
                  pendingQuestion={makePendingQuestion({
                    questions: [singleChoiceQuestion],
                  })}
                  sessionId="stress-sc"
                  onSubmit={noopAsync}
                  onCancel={noop}
                />
              </div>
            ),
          },
          {
            name: 'Optional Questions',
            description: 'required=false — Next is enabled without selection',
            content: (
              <div className="relative h-[500px] overflow-hidden">
                <QuestionForm
                  pendingQuestion={makePendingQuestion({
                    questions: [optionalQuestion1, optionalQuestion2],
                  })}
                  sessionId="stress-opt"
                  onSubmit={noopAsync}
                  onCancel={noop}
                />
              </div>
            ),
          },
          {
            name: 'Long Options (10 items)',
            description: 'Tests scrolling when there are many options',
            content: (
              <div className="relative h-[600px] overflow-hidden">
                <QuestionForm
                  pendingQuestion={makePendingQuestion({
                    questions: [longOptionsQuestion],
                  })}
                  sessionId="stress-long"
                  onSubmit={noopAsync}
                  onCancel={noop}
                />
              </div>
            ),
          },
        ]}
      />
    );
  },
};
