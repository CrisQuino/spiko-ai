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
  usage: {
    /**
     * Cost-equivalent input tokens. Uncached tokens count 1x, prompt-cache
     * writes ~1.25x and cache reads ~0.1x, so downstream cost math stays
     * accurate without knowing about caching. On the first turn this is close
     * to the raw prompt size; on later turns it collapses as the cached
     * system+history is served cheaply.
     */
    input: number;
    output: number;
    total: number;
    /** Raw prompt tokens actually processed (uncached + cache write + cache read). */
    rawInput?: number;
    /** Tokens written to the cache this turn (billed ~1.25x). */
    cacheWrite?: number;
    /** Tokens served from the cache this turn (billed ~0.1x). */
    cacheRead?: number;
  };
  provider: LLMProvider;
  model: string;
};

/** Anthropic prompt-cache billing multipliers (5-minute ephemeral cache). */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

/**
 * POST with retry + exponential backoff. Anthropic returns 429 when a
 * rate/token limit is hit and 5xx on transient errors; both are safe to retry.
 * A prompt-cache miss is never an error — it just bills at the normal input
 * rate — so caching itself never triggers a retry here.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  { retries = 3, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
      // Honor Retry-After when present, otherwise back off exponentially.
      const retryAfter = Number(response.headers.get('retry-after'));
      const backoff = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt + Math.random() * 250;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return response; // out of retries — let the caller surface the status
    } catch (err) {
      // Network/transport error: retry with backoff, then rethrow.
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * 2 ** attempt + Math.random() * 250)
        );
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed');
}

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
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

  // Prompt caching: the system prompt (role + job description + level + language)
  // is deterministic for the whole session, so cache it once and read it at ~0.1x
  // on every later turn. Sent as a content-block array so we can attach a
  // cache_control breakpoint.
  const system = [
    { type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } },
  ];

  // Incremental conversation caching: mark the LAST message so the whole
  // conversation prefix up to it is cached. On the next turn that prefix is a
  // cache read and only the new question/answer is written fresh. Two
  // breakpoints total (system + last message), well under the 4 allowed.
  const messages = opts.messages.map((m) => ({ role: m.role, content: m.content as unknown }));
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = {
      role: last.role,
      content: [
        { type: 'text', text: opts.messages[messages.length - 1].content, cache_control: { type: 'ephemeral' } },
      ],
    };
  }

  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? '';
  const uncachedInput = data.usage?.input_tokens || 0;
  const cacheWrite = data.usage?.cache_creation_input_tokens || 0;
  const cacheRead = data.usage?.cache_read_input_tokens || 0;
  const output = data.usage?.output_tokens || 0;

  const rawInput = uncachedInput + cacheWrite + cacheRead;
  // Cost-equivalent input so downstream cost math reflects the caching discount.
  const billableInput = Math.round(
    uncachedInput + cacheWrite * CACHE_WRITE_MULTIPLIER + cacheRead * CACHE_READ_MULTIPLIER
  );

  return {
    text,
    usage: {
      input: billableInput,
      output,
      total: billableInput + output,
      rawInput,
      cacheWrite,
      cacheRead,
    },
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
