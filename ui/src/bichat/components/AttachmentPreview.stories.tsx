import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'

import AttachmentPreview from './AttachmentPreview'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'
import { makeImageAttachment } from '@sb-helpers/bichatFixtures'
import { largeImageDataUrl } from '@sb-helpers/imageFixtures'

const meta: Meta<typeof AttachmentPreview> = {
  title: 'BiChat/Components/AttachmentPreview',
  component: AttachmentPreview,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof AttachmentPreview>

export const Playground: Story = {
  args: {
    attachment: makeImageAttachment(),
    onRemove: fn(),
    onClick: fn(),
  },
}

export const Readonly: Story = {
  args: {
    attachment: makeImageAttachment(),
    readonly: true,
  },
}

export const Multiple: Story = {
  render: () => (
    <div className="flex gap-4">
      <AttachmentPreview
        attachment={makeImageAttachment({ filename: 'photo-1.png' })}
        onRemove={() => {}}
        onClick={() => {}}
      />
      <AttachmentPreview
        attachment={makeImageAttachment({ filename: 'photo-2.png' })}
        onRemove={() => {}}
        onClick={() => {}}
      />
      <AttachmentPreview
        attachment={makeImageAttachment({ filename: 'photo-3.png' })}
        onRemove={() => {}}
        onClick={() => {}}
      />
    </div>
  ),
}

export const Stress: Story = {
  render: () => (
    <ScenarioGrid
      scenarios={[
        {
          name: 'Default',
          content: (
            <AttachmentPreview
              attachment={makeImageAttachment()}
              onRemove={() => {}}
              onClick={() => {}}
            />
          ),
        },
        {
          name: 'Readonly',
          content: (
            <AttachmentPreview
              attachment={makeImageAttachment()}
              readonly
            />
          ),
        },
        {
          name: 'Large Image',
          content: (
            <AttachmentPreview
              attachment={makeImageAttachment({
                filename: 'large-photo.png',
                preview: largeImageDataUrl,
              })}
              onRemove={() => {}}
              onClick={() => {}}
            />
          ),
        },
      ]}
    />
  ),
}
