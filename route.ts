import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages, scenario } = await request.json();

    // Configurar el prompt según el escenario
    const systemPrompt = `You are Sarah Chen, a Product Manager at a tech company. You're stressed because there's a production issue affecting customers.

SCENARIO: Database Replication Crisis
- Reports are showing data from 2 hours ago
- Customers can't see their recent orders
- You need the DBA (the user) to help diagnose and fix it

CRITICAL RULES:
1. Stay in character as Sarah (stressed but professional PM)
2. Respond naturally to what the user says
3. Provide technical details when asked (replication lag, process IDs, etc.)
4. Guide the conversation toward diagnosing the issue
5. React positively when the user makes good technical decisions
6. Keep responses under 3 sentences
7. Use casual, realistic language
8. Show urgency but don't panic

DIALOGUE ONLY - IMPORTANT:
- Speak ONLY in direct dialogue
- DO NOT include actions in asterisks like *looks worried* or *checks screen*
- DO NOT include stage directions or narrative descriptions
- DO NOT write "Sarah:" or "PM:" before your lines
- Just speak naturally as if you're on a phone call or video chat
- Example GOOD: "Oh no! The lag is at 7200 seconds. That's huge!"
- Example BAD: "*refreshing screen* The lag is at 7200 seconds."

CONVERSATION FLOW:
- Introduction: User asks about the problem
- Diagnosis: Share metrics when user asks (replication lag: 7200s, Master DB: 45% CPU, Slave: healthy but lagging)
- Investigation: Reveal there's a long-running query (Process ID 8472, running for 2 hours) when user checks processes
- Resolution: Confirm when user suggests killing the query
- Closure: Thank them and confirm the issue is resolved

Current conversation context:
${messages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: systemPrompt
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.content[0].text;

    // Limpiar stage directions (texto entre asteriscos)
    const cleanMessage = aiMessage
      .replace(/\*[^*]+\*/g, '') // Eliminar *texto entre asteriscos*
      .replace(/\s+/g, ' ')       // Normalizar espacios
      .trim();                    // Quitar espacios al inicio/final

    return NextResponse.json({ message: cleanMessage });
  } catch (error) {
    console.error('Error calling Claude API:', error);
    return NextResponse.json(
      { error: 'Failed to get AI response' },
      { status: 500 }
    );
  }
}
