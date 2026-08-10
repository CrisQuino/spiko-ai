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
  level?: string | null;
}): string {
  const { languageName, jobDescription, jobTitle, level } = opts;

  const levelBlock =
    level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)
      ? `\nLEARNER LEVEL: The learner's ${languageName} is around CEFR ${level}. Pitch YOUR OWN language to be understandable at that level — simpler words and shorter sentences for A1/A2, richer and faster for C1/C2 — while still pushing them slightly. Do NOT lower your standards for asking clarification; just adjust vocabulary and pace.\n`
      : '';

  const jdBlock = jobDescription
    ? `THE LEARNER'S JOB DESCRIPTION${jobTitle ? ` — TITLE: "${jobTitle}"` : ''}:
"""
${jobDescription.slice(0, 4000)}
"""

Build the scenario DIRECTLY from this job description, and treat the WHOLE role — not one single requirement. Each session, pick a DIFFERENT facet of the role (a different responsibility, system, or stakeholder from the JD) so scenarios vary. The situation, systems/tools, vocabulary and stakeholders must be realistic for THIS role. Do NOT default to a database example unless the JD is actually about databases.

MATCH THE SENIORITY AND SCOPE OF THE ROLE (critical):
- Infer the seniority from the title and JD (e.g. Engineer / Senior / Lead / Manager / Director / Head / VP).
- For a LEADERSHIP or MANAGEMENT role (manager, lead, director, head, VP), the learner's job is to ORCHESTRATE, not to hand-fix: coordinating people and teams, making trade-off decisions, delegating, unblocking, setting priorities, and communicating status/risk to stakeholders. Put the learner in that position — do NOT reduce them to a hands-on individual contributor debugging one narrow issue.
- For an individual-contributor role, hands-on technical depth is appropriate.
- Address the learner in a way consistent with their title.`
    : `No job description was provided. Play a realistic, generic professional workplace scenario (a production incident or an urgent stakeholder request).`;

  return `You are role-playing a realistic workplace colleague or stakeholder in a live conversation. Your goal is to help the learner PRACTICE speaking professional, technical ${languageName} for their actual job.

${jdBlock}
${levelBlock}
LANGUAGE (CRITICAL):
- Speak ONLY in ${languageName}. Every single response must be in ${languageName}.
- Use natural, realistic workplace ${languageName} — the way a real colleague would talk on a call or chat.

STAY IN CHARACTER:
1. Pick a believable persona (name + role) appropriate to the scenario and stay in character.
2. You have the problem/need; the LEARNER helps at the altitude of THEIR role (see seniority above). Respond naturally and contextually to what they JUST said — acknowledge their answer before moving on.
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
      level = null,
    } = body;

    const lang = getLanguage(language);
    // Provider is chosen by the LLM_PROVIDER env var (set in Vercel).
    const provider = resolveProvider();
    const systemPrompt = buildSystemPrompt({
      languageName: lang.promptName,
      jobDescription,
      jobTitle,
      level,
    });

    // Normalize incoming messages to the provider-agnostic format.
    const conversationMessages: ChatMessage[] = (messages as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    // If there are no messages yet, this is the opening turn: instruct the model
    // to start the scene. A random angle keeps scenarios varied across sessions.
    const isOpening = conversationMessages.length === 0;
    if (isOpening) {
      const angle = SCENARIO_ANGLES[Math.floor(Math.random() * SCENARIO_ANGLES.length)];
      conversationMessages.push({
        role: 'user',
        content: `Start the practice now. Open with ${angle}.
First, output ONE line exactly in the form "TITLE: <a 3-6 word scenario title in ${lang.promptName}>".
Then, on the next line, speak your opening line in character — introduce yourself and describe the situation (spoken dialogue only, in ${lang.promptName}).`,
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

    // On the opening turn, pull the "TITLE:" line out of the response so it is
    // not spoken; it becomes the scenario title shown in the UI.
    let title: string | null = null;
    let text = result.text;
    if (isOpening) {
      const match = text.match(/^\s*TITLE:\s*(.+?)\s*(?:\r?\n|$)/i);
      if (match) {
        title = match[1].replace(/["'*]/g, '').trim();
        text = text.slice(match[0].length);
      }
    }

    // Remove any stage directions (text between asterisks) and normalize spaces.
    const cleanMessage = text
      .replace(/\*[^*]+\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return NextResponse.json({
      message: cleanMessage,
      title,
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
