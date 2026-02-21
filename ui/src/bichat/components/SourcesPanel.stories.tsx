import type { Meta, StoryObj } from '@storybook/react'

import { SourcesPanel } from './SourcesPanel'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'
import { makeCitation } from '@sb-helpers/bichatFixtures'

const meta: Meta<typeof SourcesPanel> = {
  title: 'BiChat/Components/SourcesPanel',
  component: SourcesPanel,
}

export default meta
type Story = StoryObj<typeof SourcesPanel>

export const Playground: Story = {
  args: {
    citations: [
      makeCitation({
        title: "ChatGPT's Code Interpreter is limited (no internet access, etc ...)",
        url: 'https://reddit.com/r/ChatGPT/comments/code-interpreter',
        excerpt:
          'It uses the OpenAI functions to communicate with a local python interpreter, which is containerized in a docker sandbox. The UI uses next.js and ...',
      }),
      makeCitation({
        title: 'Code Interpreter | OpenAI API',
        url: 'https://developers.openai.com/docs/assistants/tools/code-interpreter',
        excerpt:
          'The Code Interpreter tool allows models to write and run Python code in a sandboxed environment to solve complex problems in domains like data analysis.',
      }),
      makeCitation({
        title: 'Responses API & Code Interpreter - OpenAI Developer Community',
        url: 'https://community.openai.com/t/responses-api-code-interpreter/924156',
        excerpt:
          'For anyone in this thread, the code interpreter is now supported in Responses API alongside Remote MCP and image generation. Many thanks to ...',
      }),
      makeCitation({
        title: 'Security - OpenAI for developers',
        url: 'https://developers.openai.com/docs/guides/safety',
        excerpt:
          'Network access is always enabled during the setup phase, which runs before the agent has access to your code. Codex CLI / IDE extension: OS-level mechanisms ...',
      }),
      makeCitation({
        title: "OpenAI's new Responses API using code interpreter - Medium",
        url: 'https://medium.com/@dev/openai-responses-api-code-interpreter',
        excerpt:
          'The code interpreter is a powerful tool that allows AI models to generate code dynamically and to actually execute it in a controlled(sandboxed) environment.',
      }),
    ],
  },
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      scenarios={[
        {
          name: 'Many Sources (12)',
          content: (
            <SourcesPanel
              citations={[
                makeCitation({ title: 'React Documentation', url: 'https://react.dev/reference/react' }),
                makeCitation({ title: 'TypeScript Handbook', url: 'https://typescriptlang.org/docs/handbook' }),
                makeCitation({ title: 'MDN Web Docs - JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' }),
                makeCitation({ title: 'Tailwind CSS Documentation', url: 'https://tailwindcss.com/docs/installation' }),
                makeCitation({ title: 'Vite Getting Started', url: 'https://vitejs.dev/guide/' }),
                makeCitation({ title: 'ESLint Configuration', url: 'https://eslint.org/docs/latest/use/configure/' }),
                makeCitation({ title: 'Node.js API Reference', url: 'https://nodejs.org/api/fs.html' }),
                makeCitation({ title: 'GitHub Actions Documentation', url: 'https://docs.github.com/en/actions' }),
                makeCitation({ title: 'Stack Overflow - React Hooks', url: 'https://stackoverflow.com/questions/53219113' }),
                makeCitation({ title: 'npm - package.json reference', url: 'https://docs.npmjs.com/cli/v10/configuring-npm/package-json' }),
                makeCitation({ title: 'Vercel Deployment Docs', url: 'https://vercel.com/docs/deployments' }),
                makeCitation({ title: 'Prisma Schema Reference', url: 'https://prisma.io/docs/reference/api-reference/prisma-schema-reference' }),
              ]}
            />
          ),
        },
        {
          name: 'With Long Excerpts',
          content: (
            <SourcesPanel
              citations={[
                makeCitation({
                  title: 'Understanding React Server Components',
                  url: 'https://react.dev/blog/2023/03/22/react-labs-march-2023',
                  excerpt:
                    'Server Components allow you to write UI that can be rendered and optionally cached on the server. In Next.js, the rendering work is further split by route segments to enable streaming and partial rendering.',
                }),
                makeCitation({
                  title: 'Next.js App Router - Nested Layouts',
                  url: 'https://nextjs.org/docs/app/building-your-application/routing/layouts-and-templates',
                  excerpt:
                    'The App Router introduces support for shared layouts, nested routing, loading states, error handling, and more. Layouts can be nested to create complex route hierarchies while sharing state.',
                }),
              ]}
            />
          ),
        },
        {
          name: 'No URLs (internal sources)',
          content: (
            <SourcesPanel
              citations={[
                makeCitation({ title: 'Internal Knowledge Base - HR Policies', url: '' }),
                makeCitation({ title: 'Company Onboarding Documentation', url: '' }),
              ]}
            />
          ),
        },
        {
          name: 'Single Source',
          content: (
            <SourcesPanel
              citations={[
                makeCitation({
                  title: 'Quarterly Revenue Report Q4 2025',
                  url: 'https://example.com/reports/q4-2025',
                  excerpt:
                    'Total revenue reached $28.5 billion, representing a 15% year-over-year increase driven by strong cloud services growth.',
                }),
              ]}
            />
          ),
        },
      ]}
    />
  ),
}
