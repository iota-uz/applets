import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import QuestionStep from './QuestionStep';
import { makePendingQuestion } from '@sb-helpers/bichatFixtures';
import type { Question } from '../types';

const meta: Meta<typeof QuestionStep> = {
  title: 'BiChat/Components/QuestionStep',
  component: QuestionStep,
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
type Story = StoryObj<typeof QuestionStep>

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

const multipleChoiceQuestion: Question = makePendingQuestion().questions[0];

const withOtherQuestion: Question = {
  id: 'q-feedback',
  text: 'How would you rate your experience?',
  type: 'SINGLE_CHOICE',
  required: false,
  options: [
    { id: 'o-great', label: 'Great', value: 'great' },
    { id: 'o-good', label: 'Good', value: 'good' },
    { id: 'o-fair', label: 'Fair', value: 'fair' },
  ],
};

export const SingleChoice: Story = {
  args: {
    question: singleChoiceQuestion,
    selectedAnswers: {},
    onAnswer: fn(),
  },
};

export const MultipleChoice: Story = {
  args: {
    question: multipleChoiceQuestion,
    selectedAnswers: {},
    onAnswer: fn(),
  },
};

export const WithOther: Story = {
  args: {
    question: withOtherQuestion,
    selectedAnswers: {
      'q-feedback': {
        options: ['Good'],
        customText: 'Very intuitive interface',
      },
    },
    onAnswer: fn(),
  },
};
