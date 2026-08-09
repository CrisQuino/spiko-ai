import { NextResponse } from 'next/server';
import { getLanguage } from '@/lib/languages';
import { chatComplete, resolveProvider, type ChatMessage } from '@/lib/llm';

// Angles used to keep JD-derived scenarios varied across sessions.
const SCENARIO_ANGLES = [
  'a live production incident that just started',
  'an urgent request from a stakeholder under deadline pressure',
  'a post-mortem / retrospective of something that went wrong',
  'a planning conversation for a risky upcoming change',
  'an escalation from a frustrated customer or teammate',
  'a debugging session where symptoms are unclear',
  'a design/architecture review with pushback',
  'an on-call handoff with missing context',
];

function buildSystemPrompt(opts: {
  languageName: string;
  jobDescription?: string | null;
  jobTitle?: string | null;
}): string {
  const { languageName, jobDescription, jobTitle } = opts;

  const jdBlock = jobDescription
    ? `THE LEARNER'S JOB DESCRIPTION${jobTitle ? ` (${jobTitle})` : ''}:
"""
${jobDescription.slice(0, 4000)}
"""

Build the scenario DIRECTLY from this job description: the situation, the systems/tools involved, the vocabulary, and the type of problem must all be realistic for THIS role. Invent a fresh, specific scenario — do NOT reuse a generic database example unless the job description is actually about databases.`
    : `No job description was provided. Play a realistic, generic professional workplace scenario (a production incident or an urgent stakeholder request).`;

  return `You are role-playing a realistic workplace colleague or stakeholder in a live conversation. Your goal is to help the learner PRACTICE speaking professional, technical ${languageName} for their actual job.

${jdBlock}

LANGUAGE (CRITICAL):
- Speak ONLY in ${languageName}. Every single response must be in ${languageName}.
- Use natural, realistic workplace ${languageName} — the way a real colleague would talk on a call or chat.

STAY IN CHARACTER:
1. Pick a believable persona (name + role) appropriate to the scenario and stay in character.
2. You have the problem/need; the LEARNER is the expert who must help. Respond naturally and contextually to what they JUST said — acknowledge their answer before moving on.
3. Keep responses concise (2-3 sentences max). Show appropriate urgency but stay professional.

DIALOGUE ONLY:
- Speak ONLY in direct dialogue. NO stage directions, NO actions like *looks worried*, no narration.

MANDATORY CLARIFICATION (this is the core of the practice):
- ALWAYS ask for clarification when the learner is vague, incomplete, or ambiguous.
- NEVER assume or fill in gaps. If they give a number without context, ask which metric, which unit, which system.
- NEVER accept one-word or partial answers ("yes", "there is", "I checked it") — ask what specifically, what the value is, what they found.
- Ask "how", "what", and "why" frequently. Make them be specific and detailed. Ask them to verify their findings.

FLOW:
- Open the scenario, describe symptoms/needs, guide investigation, reach a diagnosis, plan and implement a fix, then verify. Take your time on each step and make the learner explain thoroughly.

REMEMBER: Your job is to make the learner practice being SPECIFIC and DETAILED in ${languageName} — not to infer or assume.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      messages = [],
      language = 'en',
      jobDescription = null,
      jobTitle = null,
    } = body;

    const lang = getLanguage(language);
    // Provider is chosen by the LLM_PROVIDER env var (set in Vercel).
    const provider = resolveProvider();
    const systemPrompt = buildSystemPrompt({
      languageName: lang.promptName,
      jobDescription,
      jobTitle,
    });

    // Normalize incoming messages to the provider-agnostic format.
    const conversationMessages: ChatMessage[] = (messages as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    // If there are no messages yet, this is the opening turn: instruct the model
    // to start the scene. A random angle keeps scenarios varied across sessions.
    if (conversationMessages.length === 0) {
      const angle = SCENARIO_ANGLES[Math.floor(Math.random() * SCENARIO_ANGLES.length)];
      conversationMessages.push({
        role: 'user',
        content: `Start the practice now. Open with ${angle}. Introduce yourself in character and describe the situation to me in your first message. Speak only your opening line, in ${lang.promptName}.`,
      });
    }

    // Route to the selected provider (Claude or Kimi K2).
    const result = await chatComplete({
      provider,
      system: systemPrompt,
      messages: conversationMessages,
      maxTokens: 250,
    });

    const tokenUsage = { ...result.usage };

    // Remove any stage directions (text between asterisks) and normalize spaces.
    const cleanMessage = result.text
      .replace(/\*[^*]+\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return NextResponse.json({
      message: cleanMessage,
      tokenUsage,
      provider: result.provider,
      model: result.model,
    });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
