import type { Meta, StoryObj } from '@storybook/react';

import ConfirmationStep from './ConfirmationStep';
import type { Question, QuestionAnswers } from '../types';

const meta: Meta<typeof ConfirmationStep> = {
  title: 'BiChat/Components/ConfirmationStep',
  component: ConfirmationStep,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[520px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ConfirmationStep>

const singleQuestion: Question = {
  id: 'q-metric',
  text: 'Which metric do you want to focus on?',
  type: 'SINGLE_CHOICE',
  required: true,
  options: [
    { id: 'o-rev', label: 'Revenue', value: 'revenue' },
    { id: 'o-margin', label: 'Gross Margin', value: 'margin' },
    { id: 'o-orders', label: 'Order Count', value: 'orders' },
  ],
};

const singleAnswers: QuestionAnswers = {
  'q-metric': { options: ['Revenue'] },
};

const multipleQuestions: Question[] = [
  {
    id: 'q-region',
    text: 'Which regions should the report cover?',
    type: 'MULTIPLE_CHOICE',
    required: true,
    options: [
      { id: 'o-emea', label: 'EMEA', value: 'EMEA' },
      { id: 'o-apac', label: 'APAC', value: 'APAC' },
      { id: 'o-amer', label: 'Americas', value: 'AMER' },
    ],
  },
  {
    id: 'q-metric',
    text: 'Which metric do you want to focus on?',
    type: 'SINGLE_CHOICE',
    required: true,
    options: [
      { id: 'o-rev', label: 'Revenue', value: 'revenue' },
      { id: 'o-margin', label: 'Gross Margin', value: 'margin' },
    ],
  },
  {
    id: 'q-format',
    text: 'Any special formatting preferences?',
    type: 'MULTIPLE_CHOICE',
    required: false,
    options: [
      { id: 'o-chart', label: 'Include charts', value: 'charts' },
      { id: 'o-table', label: 'Include data table', value: 'table' },
    ],
  },
];

const multipleAnswers: QuestionAnswers = {
  'q-region': { options: ['EMEA', 'APAC'] },
  'q-metric': { options: ['Revenue'], customText: 'Focus on year-over-year growth' },
  'q-format': { options: ['Include charts', 'Include data table'] },
};

export const Playground: Story = {
  args: {
    questions: [singleQuestion],
    answers: singleAnswers,
  },
};

export const MultipleQuestions: Story = {
  args: {
    questions: multipleQuestions,
    answers: multipleAnswers,
  },
};
