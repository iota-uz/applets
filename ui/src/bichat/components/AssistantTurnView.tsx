/**
 * AssistantTurnView Component (Layer 4 - Backward Compatible)
 * Displays assistant messages with markdown, charts, sources, downloads, code outputs, and streaming cursor
 *
 * Uses turn-based architecture - receives a ConversationTurn and displays
 * the assistantTurn content.
 *
 * For more customization, use the AssistantMessage component directly with slots.
 */

import { useMemo } from 'react';
import { useChatSession, useChatMessaging } from '../context/ChatContext';
import { useIotaContext } from '../context/IotaContext';
import {
  AssistantMessage,
  type AssistantMessageSlots,
  type AssistantMessageClassNames,
  type RegenerateModelOption,
} from './AssistantMessage';
import { SystemMessage } from './SystemMessage';
import type { ConversationTurn } from '../types';

export interface AssistantTurnViewProps {
  /** The conversation turn containing the assistant response */
  turn: ConversationTurn
  /** When true, this is the last turn in the list (Regenerate button shown only on last assistant message) */
  isLastTurn?: boolean
  /** Whether the response is currently being streamed */
  isStreaming?: boolean
  /** Slot overrides for customization */
  slots?: AssistantMessageSlots
  /** Class name overrides */
  classNames?: AssistantMessageClassNames
  /** Hide avatar */
  hideAvatar?: boolean
  /** Hide actions */
  hideActions?: boolean
  /** Hide timestamp */
  hideTimestamp?: boolean
  /** Whether regenerate action should be available */
  allowRegenerate?: boolean
}

export function AssistantTurnView({
  turn,
  isLastTurn = false,
  isStreaming = false,
  slots,
  classNames,
  hideAvatar,
  hideActions,
  hideTimestamp,
  allowRegenerate = true,
}: AssistantTurnViewProps) {
  const { debugMode } = useChatSession();
  const { handleCopy, handleRegenerate, pendingQuestion, sendMessage, loading } = useChatMessaging();
  const iotaContext = useIotaContext();
  const regenerateModels = useMemo<RegenerateModelOption[] | undefined>(() => {
    const models = iotaContext.extensions?.llm?.models;
    if (!models || models.length < 2) {return undefined;}
    return models.map((m) => ({ id: m.id, label: m.label }));
  }, [iotaContext.extensions?.llm?.models]);

  const assistantTurn = turn.assistantTurn;
  if (!assistantTurn) {return null;}

  if (assistantTurn.role === 'system') {
    return (
      <SystemMessage
        content={assistantTurn.content}
        createdAt={assistantTurn.createdAt}
        onCopy={handleCopy}
        hideActions={hideActions}
        hideTimestamp={hideTimestamp}
      />
    );
  }

  return (
    <AssistantMessage
      turn={assistantTurn}
      turnId={turn.id}
      isLastTurn={isLastTurn}
      isStreaming={isStreaming}
      pendingQuestion={pendingQuestion}
      slots={slots}
      classNames={classNames}
      onCopy={handleCopy}
      onRegenerate={allowRegenerate ? handleRegenerate : undefined}
      regenerateModels={allowRegenerate ? regenerateModels : undefined}
      onSendMessage={sendMessage}
      sendDisabled={loading || isStreaming}
      hideAvatar={hideAvatar}
      hideActions={hideActions}
      hideTimestamp={hideTimestamp}
      showDebug={debugMode}
    />
  );
}

export default AssistantTurnView;
