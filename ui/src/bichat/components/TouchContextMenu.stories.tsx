import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Copy, Trash, PencilSimple, ShareNetwork, Star, Flag, ArrowBendUpLeft, DownloadSimple } from '@phosphor-icons/react'

import { TouchContextMenu } from './TouchContextMenu'
import type { ContextMenuItem } from './TouchContextMenu'
import { ScenarioGrid } from '@sb-helpers/ScenarioGrid'

const meta: Meta<typeof TouchContextMenu> = {
  title: 'BiChat/Components/TouchContextMenu',
  component: TouchContextMenu,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof TouchContextMenu>

const anchorRect = new DOMRect(200, 200, 280, 40)

const basicItems: ContextMenuItem[] = [
  { id: 'copy', label: 'Copy message', icon: <Copy size={16} weight="bold" />, onClick: fn() },
  { id: 'edit', label: 'Edit message', icon: <PencilSimple size={16} weight="bold" />, onClick: fn() },
  { id: 'delete', label: 'Delete message', icon: <Trash size={16} weight="bold" />, onClick: fn(), variant: 'danger' },
]

export const Playground: Story = {
  args: {
    items: basicItems,
    isOpen: true,
    onClose: fn(),
    anchorRect,
  },
}

export const Stress: Story = {
  render: () => {
    const noop = fn()
    const close = fn()

    const disabledItems: ContextMenuItem[] = [
      { id: 'copy', label: 'Copy message', icon: <Copy size={16} weight="bold" />, onClick: noop },
      { id: 'edit', label: 'Edit message', icon: <PencilSimple size={16} weight="bold" />, onClick: noop, disabled: true },
      { id: 'share', label: 'Share', icon: <ShareNetwork size={16} weight="bold" />, onClick: noop, disabled: true },
      { id: 'delete', label: 'Delete message', icon: <Trash size={16} weight="bold" />, onClick: noop, variant: 'danger' },
    ]

    const textOnlyItems: ContextMenuItem[] = [
      { id: 'reply', label: 'Reply', onClick: noop },
      { id: 'forward', label: 'Forward', onClick: noop },
      { id: 'pin', label: 'Pin message', onClick: noop },
    ]

    const manyItems: ContextMenuItem[] = [
      { id: 'reply', label: 'Reply', icon: <ArrowBendUpLeft size={16} weight="bold" />, onClick: noop },
      { id: 'copy', label: 'Copy message', icon: <Copy size={16} weight="bold" />, onClick: noop },
      { id: 'edit', label: 'Edit message', icon: <PencilSimple size={16} weight="bold" />, onClick: noop },
      { id: 'star', label: 'Star message', icon: <Star size={16} weight="bold" />, onClick: noop },
      { id: 'share', label: 'Share', icon: <ShareNetwork size={16} weight="bold" />, onClick: noop },
      { id: 'download', label: 'Download', icon: <DownloadSimple size={16} weight="bold" />, onClick: noop },
      { id: 'report', label: 'Report', icon: <Flag size={16} weight="bold" />, onClick: noop, variant: 'danger' },
      { id: 'delete', label: 'Delete message', icon: <Trash size={16} weight="bold" />, onClick: noop, variant: 'danger' },
    ]

    const dangerOnlyItems: ContextMenuItem[] = [
      { id: 'report', label: 'Report message', icon: <Flag size={16} weight="bold" />, onClick: noop, variant: 'danger' },
      { id: 'delete', label: 'Delete forever', icon: <Trash size={16} weight="bold" />, onClick: noop, variant: 'danger' },
    ]

    return (
      <ScenarioGrid
        columns={2}
        scenarios={[
          {
            name: 'Mixed icons + danger variant',
            content: (
              <TouchContextMenu items={basicItems} isOpen={true} onClose={close} anchorRect={new DOMRect(0, 0, 260, 40)} />
            ),
          },
          {
            name: 'Disabled items (Edit, Share greyed out)',
            content: (
              <TouchContextMenu items={disabledItems} isOpen={true} onClose={close} anchorRect={new DOMRect(0, 0, 260, 40)} />
            ),
          },
          {
            name: 'Text only (no icons)',
            content: (
              <TouchContextMenu items={textOnlyItems} isOpen={true} onClose={close} anchorRect={new DOMRect(0, 0, 260, 40)} />
            ),
          },
          {
            name: 'Many items (8 items, potential scroll)',
            content: (
              <TouchContextMenu items={manyItems} isOpen={true} onClose={close} anchorRect={new DOMRect(0, 0, 260, 40)} />
            ),
          },
          {
            name: 'All danger items',
            content: (
              <TouchContextMenu items={dangerOnlyItems} isOpen={true} onClose={close} anchorRect={new DOMRect(0, 0, 260, 40)} />
            ),
          },
        ]}
      />
    )
  },
}
