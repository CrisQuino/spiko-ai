import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateCEFR } from '@/lib/cefr-evaluator';
import { calculateCost } from '@/lib/cost-calculator';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('📝 [LESSON COMPLETE] Starting...');
  
  try {
    const body = await request.json();
    const { 
      lessonId, 
      messages, 
      durationSeconds, 
      tokenUsage,
      clarificationCount = 0
    } = body;

    console.log('📊 [INPUT] LessonID:', lessonId);
    console.log('📊 [INPUT] Messages:', messages?.length || 0);
    console.log('📊 [INPUT] Duration:', durationSeconds, 'seconds');
    console.log('📊 [INPUT] Tokens:', tokenUsage);
    console.log('📊 [INPUT] Clarifications:', clarificationCount);

    // Get token from Authorization header (optional for demo mode)
    const authHeader = request.headers.get('authorization');
    let user = null;
    let isDemoMode = !authHeader;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      console.log('🔑 [AUTH] Token received for completion');

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authUser && !authError) {
        user = authUser;
        console.log('✅ [USER] Authenticated:', user.id);
      } else {
        console.log('⚠️ [AUTH] Token invalid, treating as demo mode');
        isDemoMode = true;
      }
    } else {
      console.log('🎭 [DEMO MODE] No auth token, running as demo');
    }

    // Extract user messages for CEFR evaluation
    const userMessages = messages?.filter((m: any) => m.role === 'user').map((m: any) => m.content) || [];
    
    if (userMessages.length === 0) {
      console.warn('⚠️ [WARNING] No user messages found for evaluation');
      return NextResponse.json({
        success: false,
        error: 'No user messages to evaluate'
      }, { status: 400 });
    }

    // Calculate CEFR assessment
    console.log('🧮 [CEFR] Starting evaluation...');
    const evalStart = Date.now();
    const assessment = evaluateCEFR(
      userMessages,
      durationSeconds,
      'production_incident',
      clarificationCount
    );
    console.log(`✅ [CEFR] Completed in ${Date.now() - evalStart}ms`);
    console.log('📊 [CEFR] Overall:', assessment.overall.level);

    // Calculate costs - map the token format correctly
    const tokenUsageForCalculation = {
      inputTokens: tokenUsage?.input || 0,
      outputTokens: tokenUsage?.output || 0,
      totalTokens: (tokenUsage?.input || 0) + (tokenUsage?.output || 0)
    };
    
    const costs = calculateCost(tokenUsageForCalculation);
    console.log('💰 [COST] Input:', costs.inputCost, 'Output:', costs.outputCost, 'Total:', costs.totalCost);

    // If authenticated, save to database
    if (user && lessonId) {
      console.log('💾 [DB] Saving to lesson_costs...');
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: request.headers.get('authorization')!
            }
          }
        }
      );

      const { error: updateError } = await supabase
        .from('lesson_costs')
        .update({
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          total_tokens: tokenUsageForCalculation.totalTokens,
          input_tokens: tokenUsageForCalculation.inputTokens,
          output_tokens: tokenUsageForCalculation.outputTokens,
          input_cost: costs.inputCost,
          output_cost: costs.outputCost,
          total_cost: costs.totalCost,
          cefr_overall: assessment.overall.level,
          pronunciation_level: assessment.pronunciation.level,
          pronunciation_score: assessment.pronunciation.score,
          fluency_level: assessment.fluency.level,
          fluency_score: assessment.fluency.score,
          vocabulary_level: assessment.vocabulary.level,
          vocabulary_score: assessment.vocabulary.score,
          grammar_level: assessment.grammar.level,
          grammar_score: assessment.grammar.score,
          interaction_level: assessment.interaction.level,
          interaction_score: assessment.interaction.score,
          comprehension_level: assessment.comprehension.level,
          comprehension_score: assessment.comprehension.score,
          quick_feedback: assessment.quickFeedback,
          final_feedback: assessment.finalFeedback,
          technical_terms_used: assessment.technicalJargon.termsUsed,
          technical_accuracy_level: assessment.technicalJargon.level
        })
        .eq('lesson_id', lessonId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('❌ [DB ERROR]:', updateError);
      } else {
        console.log('✅ [DB] Lesson updated successfully');
      }
    } else {
      console.log('🎭 [DEMO] Skipping database save (demo mode or no lessonId)');
    }

    const totalTime = Date.now() - startTime;
    console.log(`⏱️ [COMPLETE] Total time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      assessment,
      costs,
      demoMode: isDemoMode
    });

  } catch (error: any) {
    console.error('❌ [ERROR]:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
