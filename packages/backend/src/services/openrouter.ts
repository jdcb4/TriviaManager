export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function openrouterChat(model: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY
  if (!apiKey) throw new Error('OPEN_ROUTER_API_KEY not set')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://triviamanager.app',
      'X-Title': 'TriviaManager',
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.choices[0]?.message?.content ?? ''
}
