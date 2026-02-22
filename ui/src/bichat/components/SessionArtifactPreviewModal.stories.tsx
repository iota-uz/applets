import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { SessionArtifactPreviewModal } from './SessionArtifactPreviewModal'
import type { SessionArtifact } from '../types'

const meta: Meta<typeof SessionArtifactPreviewModal> = {
  title: 'BiChat/Components/SessionArtifactPreviewModal',
  component: SessionArtifactPreviewModal,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof SessionArtifactPreviewModal>

const mockArtifact: SessionArtifact = {
  id: 'artifact-1',
  sessionId: 'session-1',
  type: 'export',
  name: 'Q4 Revenue Report.xlsx',
  description: 'Quarterly revenue breakdown by region',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  sizeBytes: 184_320,
  url: 'https://example.com/files/Q4-Revenue-Report.xlsx',
  createdAt: '2025-01-15T10:00:00.000Z',
}

const pdfArtifact: SessionArtifact = {
  id: 'artifact-2',
  sessionId: 'session-1',
  type: 'export',
  name: 'Annual Report 2025.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2_100_000,
  url: 'https://example.com/files/Annual-Report-2025.pdf',
  createdAt: '2025-01-15T10:00:00.000Z',
}

export const Playground: Story = {
  args: {
    isOpen: true,
    artifact: mockArtifact,
    canRename: true,
    canDelete: true,
    onClose: fn(),
    onRename: fn(async () => {}),
    onDelete: fn(async () => {}),
  },
}

export const ReadOnly: Story = {
  args: {
    isOpen: true,
    artifact: pdfArtifact,
    canRename: false,
    canDelete: false,
    onClose: fn(),
    onRename: fn(async () => {}),
    onDelete: fn(async () => {}),
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
    artifact: null,
    onClose: fn(),
  },
}
