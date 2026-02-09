/**
 * Basic Usage Example for BiChat Library
 *
 * This example demonstrates:
 * - Props-based configuration
 * - HTTP data source setup
 * - Rate limiting
 * - Stream cancellation
 * - Complete chat interface
 */

import React from 'react'
import {
  ConfigProvider,
  ChatSessionProvider,
  ChatSession,
  createHttpDataSource,
  RateLimiter,
  BiChatConfig,
  useChatSession,
  useChatMessaging,
  useChatInput,
} from '@iota-uz/sdk/bichat'

// 1. Define your configuration
const biChatConfig: BiChatConfig = {
  user: {
    id: '123',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    permissions: ['chat.read', 'chat.write', 'chat.delete'],
  },
  tenant: {
    id: 'tenant-abc',
    name: 'Acme Corporation',
  },
  locale: {
    language: 'en',
    translations: {
      'chat.title': 'Chat Assistant',
      'chat.placeholder': 'Type your message here...',
      'chat.send': 'Send',
      'chat.cancel': 'Cancel',
      'chat.error': 'An error occurred',
    },
  },
  endpoints: {
    rpc: '/api/rpc',
    stream: '/api/stream',
  },
  csrfToken: 'your-csrf-token-here',
}

// 2. Create HTTP data source
const dataSource = createHttpDataSource({
  baseUrl: 'https://api.example.com',
  rpcEndpoint: '/rpc',
  streamEndpoint: '/stream',
  csrfToken: () => biChatConfig.csrfToken || '',
  headers: {
    'X-Custom-Header': 'custom-value',
  },
  timeout: 30000,
})

// 3. Create rate limiter (20 requests per minute)
const rateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000,
})

// 4. Custom Chat Interface Component
function CustomChatInterface() {
  const { error } = useChatSession()
  const { turns, loading, isStreaming, streamingContent, cancel } = useChatMessaging()
  const { message, setMessage, handleSubmit } = useChatInput()

  return (
    <div className="chat-interface">
      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setMessage('')}>Dismiss</button>
        </div>
      )}

      {/* Messages List (turn-based) */}
      <div className="messages-container">
        {turns.map((turn) => (
          <div key={turn.id}>
            <div className="message message-user">
              <div className="message-content">{turn.userTurn?.content}</div>
              <div className="message-time">
                {turn.userTurn?.createdAt
                  ? new Date(turn.userTurn.createdAt).toLocaleTimeString()
                  : ''}
              </div>
            </div>
            {turn.assistantTurn && (
              <div className="message message-assistant">
                <div className="message-content">{turn.assistantTurn.content}</div>
                <div className="message-time">
                  {turn.assistantTurn.createdAt
                    ? new Date(turn.assistantTurn.createdAt).toLocaleTimeString()
                    : ''}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming Content */}
        {isStreaming && streamingContent && (
          <div className="message message-assistant streaming">
            <div className="message-content">{streamingContent}</div>
            <div className="streaming-indicator">Typing...</div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="message-input-form">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={loading || isStreaming}
          className="message-input"
        />

        {isStreaming ? (
          <button type="button" onClick={cancel} className="cancel-button">
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!message.trim() || loading}
            className="send-button"
          >
            Send
          </button>
        )}
      </form>

      {/* Loading Indicator */}
      {loading && !isStreaming && (
        <div className="loading-indicator">Processing...</div>
      )}
    </div>
  )
}

// 5. Main App Component
export default function App() {
  return (
    <ConfigProvider config={biChatConfig}>
      <ChatSessionProvider
        dataSource={dataSource}
        sessionId="session-123" // optional: leave empty for new session
        rateLimiter={rateLimiter}
      >
        <div className="app-container">
          <header className="app-header">
            <h1>BiChat Example</h1>
          </header>

          <main className="app-main">
            {/* Option 1: Use built-in ChatSession component */}
            <ChatSession />

            {/* Option 2: Use custom interface */}
            {/* <CustomChatInterface /> */}
          </main>
        </div>
      </ChatSessionProvider>
    </ConfigProvider>
  )
}

// Alternative: Using global configuration (server-side injection)
export function AppWithGlobalConfig() {
  return (
    <ConfigProvider useGlobalConfig={true}>
      <ChatSessionProvider dataSource={dataSource} rateLimiter={rateLimiter}>
        <ChatSession />
      </ChatSessionProvider>
    </ConfigProvider>
  )
}
