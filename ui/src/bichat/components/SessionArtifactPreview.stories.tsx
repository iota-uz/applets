import type { Meta, StoryObj } from '@storybook/react'

import { SessionArtifactPreview } from './SessionArtifactPreview'
import type { SessionArtifact } from '../types'

const meta: Meta<typeof SessionArtifactPreview> = {
  title: 'BiChat/Components/SessionArtifactPreview',
  component: SessionArtifactPreview,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SessionArtifactPreview>

const now = new Date().toISOString()

const imageArtifact: SessionArtifact = {
  id: 'art-img',
  sessionId: 'session-1',
  type: 'attachment',
  name: 'dashboard_chart.png',
  mimeType: 'image/png',
  url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Preview+Image',
  sizeBytes: 128000,
  createdAt: now,
}

const excelArtifact: SessionArtifact = {
  id: 'art-xlsx',
  sessionId: 'session-1',
  type: 'export',
  name: 'quarterly_report.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  url: 'https://example.com/files/quarterly_report.xlsx',
  sizeBytes: 184320,
  createdAt: now,
}

const pdfArtifact: SessionArtifact = {
  id: 'art-pdf',
  sessionId: 'session-1',
  type: 'export',
  name: 'annual_report.pdf',
  mimeType: 'application/pdf',
  url: 'https://example.com/files/annual_report.pdf',
  sizeBytes: 2200000,
  createdAt: now,
}

export const Playground: Story = {
  args: {
    artifact: imageArtifact,
  },
}

export const Excel: Story = {
  args: {
    artifact: excelArtifact,
  },
}

export const PDF: Story = {
  args: {
    artifact: pdfArtifact,
  },
}
