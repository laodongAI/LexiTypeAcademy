export interface RetryableMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Returns the persisted tail user message only when it is the exact request being retried.
 * This is deliberately strict: never reuse an older matching message from the conversation.
 */
export function findRetryablePendingMessage<T extends RetryableMessage>(
  messages: T[],
  userText: string,
): T | undefined {
  const lastMessage = messages[messages.length - 1]
  return lastMessage?.role === 'user' && lastMessage.content === userText
    ? lastMessage
    : undefined
}
