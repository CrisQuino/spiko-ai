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

  // Each level sets a HARD cap on how long and complex YOUR turn is, plus how
  // many questions you may ask at once. Lower levels = shorter sentences and a
  // SINGLE simple question, so the input never runs above the learner's level.
  const levelGuidance: Record<string, string> = {
    A1: 'ONE short sentence (max ~8 words), then AT MOST ONE very simple question. Only the most common words, present tense. No idioms, no jargon, no complex clauses. Never stack two questions. Speak slowly and concretely.',
    A2: '1–2 short sentences (max ~10-12 words EACH), then AT MOST ONE simple question. Common everyday/work words only. No complex or subordinate clauses, no idioms, no dense jargon. NEVER ask several things in one turn. If a technical term is unavoidable, explain it plainly.',
    B1: '2 sentences of moderate length, then ONE clear question. Common work vocabulary; simple connectors are fine; avoid rare or highly idiomatic expressions. At most one question per turn.',
    B2: 'Natural professional register. 2–3 sentences at normal pace; idioms and technical terms are fine; a focused follow-up question is fine.',
    C1: 'Rich, fluent, professional. Full range, nuance, and idiomatic expressions welcome; you may probe with layered questions.',
    C2: 'Fully natural and sophisticated, native-like range and speed.',
  };
  const levelBlock =
    level && levelGuidance[level]
      ? `\nLEARNER LEVEL — CRITICAL, OVERRIDES EVERYTHING BELOW: The learner's ${languageName} is CEFR ${level}. Calibrate YOUR OWN speech to this exact level: ${levelGuidance[level]}
This controls HOW you speak so the learner can follow. It takes PRECEDENCE over the general "concise" and "clarification" instructions below: at lower levels you STILL push the learner to be specific, but you do it with SHORT, SIMPLE sentences and ONE question at a time — never overwhelm them with language above their level. An A2 turn must look clearly shorter and simpler than a C1 turn.\n`
      : '';

  const jdBlock = jobDescription
    ? `THE LEARNER'S JOB DESCRIPTION${jobTitle ? ` — TITLE: "${jobTitle}"` : ''}:
"""
${jobDescription.slice(0, 4000)}
"""

THE LEARNER IS THIS PERSON${jobTitle ? `: the "${jobTitle}"` : ''}. You are NOT testing whether they can code or debug — you are simulating a real work conversation where THIS person must communicate at the level of THEIR job. Build the scenario DIRECTLY from the job description, and treat the WHOLE role — not one narrow requirement. Each session, pick a DIFFERENT facet of the role (a different responsibility, system, or stakeholder from the JD) so scenarios vary. Do NOT default to a database example unless the JD is actually about databases.

MATCH THE SENIORITY AND SCOPE OF THE ROLE — THIS IS THE #1 RULE:
- Read the title and JD and identify the altitude: individual contributor vs. LEADERSHIP (lead / manager / director / head / VP / chief).
- If it is a LEADERSHIP role, the learner does NOT do hands-on technical work in this conversation. NEVER ask them to run a command, write a query, debug a log, or perform a technical step themselves. Instead, the scenario must exercise LEADERSHIP communication: making a trade-off decision, setting direction and priorities, delegating to and unblocking their teams, handling an escalation, managing budget/timeline/risk, aligning stakeholders, or reporting status upward. You (your persona) are someone who needs the ${jobTitle || 'leader'}'s DECISION, DIRECTION, or ALIGNMENT — not their hands on a keyboard. Example: for a Director of Software Engineering, a good scenario is a VP asking how they'll handle a delivery slipping across three teams — NOT "can you check why the DNS is failing".
- Only for an individual-contributor role is hands-on technical depth appropriate.
- Speak to the learner as the ${jobTitle || 'person'} they are.`
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
3. Keep responses concise. Default to 2-3 sentences max — but if a LEARNER LEVEL is set above, ITS length limit wins (e.g. A1/A2 = shorter). Show appropriate urgency but stay professional.

DIALOGUE ONLY:
- Speak ONLY in direct dialogue. NO stage directions, NO actions like *looks worried*, no narration.

MANDATORY CLARIFICATION (this is the core of the practice):
- ALWAYS ask for clarification when the learner is vague, incomplete, or ambiguous.
- NEVER assume or fill in gaps. If they give a number without context, ask which metric, which unit, which system.
- NEVER accept one-word or partial answers ("yes", "there is", "I checked it") — ask what specifically, what the value is, what they found.
- Ask "how", "what", and "why" frequently. Make them be specific and detailed. Ask them to verify their findings.
- MATCH THE CLARIFICATION TO THE LEARNER LEVEL: at low levels (A1/A2) ask ONE short, simple clarification question at a time — do NOT stack multiple questions or use complex phrasing. Higher levels can take layered questions.

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
Then output ONE line exactly in the form "SPEAKER: <your persona's first name only>" — the name you chose for your character.
Then, on the next line, speak your opening line in character — introduce yourself (use that same name) and describe the situation (spoken dialogue only, in ${lang.promptName}).${level ? ` Keep this opening at the learner's CEFR ${level} level: honor the length/complexity limit above (for A1/A2, a short, simple greeting + situation in a couple of short sentences — not a long paragraph).` : ''}`,
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
    let speaker: string | null = null;
    let text = result.text;
    if (isOpening) {
      const match = text.match(/^\s*TITLE:\s*(.+?)\s*(?:\r?\n|$)/i);
      if (match) {
        title = match[1].replace(/["'*]/g, '').trim();
        text = text.slice(match[0].length);
      }
      // Pull the model-chosen persona name so the UI can label the AI dynamically
      // (a different believable person per scenario), instead of a fixed "Sarah".
      const sp = text.match(/^\s*SPEAKER:\s*(.+?)\s*(?:\r?\n|$)/i);
      if (sp) {
        speaker = sp[1].replace(/["'*.]/g, '').trim().split(/\s+/)[0] || null;
        text = text.slice(sp[0].length);
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
      speaker,
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
