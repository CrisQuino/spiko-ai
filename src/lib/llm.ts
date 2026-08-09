/**
 * LLM provider switch.
 *
 * Lets the app send the SAME prompt to either Claude (Anthropic) or Kimi K2
 * (Moonshot, OpenAI-compatible API) so prompts can be iterated on cheaply.
 *
 * The provider is chosen per request; if none is given it falls back to the
 * `LLM_PROVIDER` env var, then to Anthropic.
 */

export type LLMProvider = 'anthropic' | 'moonshot';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatResult = {
  text: string;
  usage: { input: number; output: number; total: number };
  provider: LLMProvider;
  model: string;
};

/**
 * Resolve the active provider. Selection is driven by the `LLM_PROVIDER`
 * environment variable (set in Vercel); the optional argument only exists for
 * tests/overrides. Falls back to Anthropic.
 */
export function resolveProvider(requested?: string | null): LLMProvider {
  const value = (requested || '').toLowerCase();
  if (value === 'moonshot' || value === 'kimi' || value === 'kimi-k2') return 'moonshot';
  if (value === 'anthropic' || value === 'claude') return 'anthropic';

  const envDefault = (process.env.LLM_PROVIDER || '').toLowerCase();
  if (envDefault === 'moonshot' || envDefault === 'kimi') return 'moonshot';

  return 'anthropic';
}

async function callAnthropic(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<ChatResult> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';
  const input = data.usage?.input_tokens || 0;
  const output = data.usage?.output_tokens || 0;

  return {
    text,
    usage: { input, output, total: input + output },
    provider: 'anthropic',
    model,
  };
}

async function callMoonshot(opts: {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}): Promise<ChatResult> {
  const baseUrl = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1';
  const model = process.env.MOONSHOT_MODEL || 'kimi-k2.6';
  const apiKey = process.env.MOONSHOT_API_KEY || '';

  if (!apiKey) {
    throw new Error('MOONSHOT_API_KEY is not configured');
  }

  // OpenAI-compatible chat completions payload; the system prompt is the first
  // message rather than a top-level field.
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      temperature: 0.8,
      messages: [{ role: 'system', content: opts.system }, ...opts.messages],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Moonshot API error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const input = data.usage?.prompt_tokens || 0;
  const output = data.usage?.completion_tokens || 0;

  return {
    text,
    usage: { input, output, total: data.usage?.total_tokens || input + output },
    provider: 'moonshot',
    model,
  };
}

/** Send a chat completion to the selected provider and return a normalized result. */
export async function chatComplete(opts: {
  provider: LLMProvider;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<ChatResult> {
  const maxTokens = opts.maxTokens ?? 250;
  if (opts.provider === 'moonshot') {
    return callMoonshot({ system: opts.system, messages: opts.messages, maxTokens });
  }
  return callAnthropic({ system: opts.system, messages: opts.messages, maxTokens });
}
