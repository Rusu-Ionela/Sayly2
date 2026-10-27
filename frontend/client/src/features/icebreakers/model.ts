/** First message when replying to someone's answer; the member edits it before sending. */
export function replyDraft(question: string, answer: string) {
  const quoted = answer.length > 80 ? `${answer.slice(0, 77)}…` : answer;
  return `Hi! I saw your answer to "${question}": "${quoted}" `;
}
