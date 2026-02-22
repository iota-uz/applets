import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';

import { ErrorBoundary } from './ErrorBoundary';
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid';

const meta: Meta<typeof ErrorBoundary> = {
  title: 'BiChat/Components/ErrorBoundary',
  component: ErrorBoundary,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>

/**
 * A component that unconditionally throws on render.
 */
function ThrowingComponent({ message = 'Something broke!' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

export const CaughtError: Story = {
  args: {
    onError: fn(),
  },
  render: (args) => (
    <div className="w-[400px]">
      <ErrorBoundary onError={args.onError}>
        <ThrowingComponent message="Simulated render crash" />
      </ErrorBoundary>
    </div>
  ),
};

export const CustomFallbackNode: Story = {
  render: () => (
    <div className="w-[400px]">
      <ErrorBoundary
        fallback={
          <div className="p-6 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 text-center">
            <p className="font-medium">Custom static fallback</p>
            <p className="text-sm mt-1 opacity-70">This ReactNode replaces the default error UI.</p>
          </div>
        }
      >
        <ThrowingComponent message="Custom fallback test" />
      </ErrorBoundary>
    </div>
  ),
};

export const CustomFallbackFunction: Story = {
  render: () => (
    <div className="w-[400px]">
      <ErrorBoundary
        fallback={(error, reset) => (
          <div className="p-6 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg border border-violet-200 dark:border-violet-800 text-center space-y-3">
            <p className="font-medium">Render function fallback</p>
            <p className="text-sm opacity-70">Error: {error?.message}</p>
            <button
              onClick={reset}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Reset boundary
            </button>
          </div>
        )}
      >
        <ThrowingComponent message="Render function fallback test" />
      </ErrorBoundary>
    </div>
  ),
};

export const Normal: Story = {
  render: () => (
    <div className="w-[400px]">
      <ErrorBoundary>
        <div className="p-6 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800 text-center">
          Content rendered successfully — no error.
        </div>
      </ErrorBoundary>
    </div>
  ),
};

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      columns={2}
      scenarios={[
        {
          name: 'Default error UI (with reset button)',
          content: (
            <div className="w-full">
              <ErrorBoundary>
                <ThrowingComponent message="Network timeout after 30s" />
              </ErrorBoundary>
            </div>
          ),
        },
        {
          name: 'Static ReactNode fallback',
          content: (
            <div className="w-full">
              <ErrorBoundary
                fallback={
                  <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 text-center">
                    Oops, something failed. Please refresh.
                  </div>
                }
              >
                <ThrowingComponent />
              </ErrorBoundary>
            </div>
          ),
        },
        {
          name: 'Render function fallback (error + reset)',
          content: (
            <div className="w-full">
              <ErrorBoundary
                fallback={(error, reset) => (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-700 dark:text-amber-300 text-center space-y-2">
                    <p>{error?.message}</p>
                    <button onClick={reset} className="underline text-xs">Reset</button>
                  </div>
                )}
              >
                <ThrowingComponent message="JSON parse error at position 42" />
              </ErrorBoundary>
            </div>
          ),
        },
        {
          name: 'No error — children render normally',
          content: (
            <div className="w-full">
              <ErrorBoundary>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm text-center">
                  All good here.
                </div>
              </ErrorBoundary>
            </div>
          ),
        },
      ]}
    />
  ),
};
