import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenarioType = 'database', demoMode = false } = body;

    console.log('🚀 [LESSON START] Request received:', { scenarioType, demoMode });

    // DEMO MODE: Skip authentication for testing
    if (demoMode) {
      const lessonId = crypto.randomUUID();
      console.log('🎮 [DEMO MODE] Creating lesson without authentication:', lessonId);
      
      return NextResponse.json({
        lessonId,
        startedAt: new Date().toISOString(),
        demoMode: true
      });
    }

    // NORMAL MODE: Require authentication via Bearer token
    console.log('🔐 [AUTH MODE] Checking user authentication...');
    
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ [AUTH ERROR] No authorization header or invalid format');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('🔑 [AUTH] Token received, length:', token.length);

    // Create Supabase client with the token
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
    
    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [AUTH ERROR]:', authError?.message || 'No user found');
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }

    console.log('✅ [USER FOUND] ID:', user.id, 'Email:', user.email);

    // Generate lesson ID
    const lessonId = crypto.randomUUID();
    console.log('🆔 [LESSON ID] Generated:', lessonId);

    // Insert into database
    console.log('💾 [DB INSERT] Attempting to create lesson_costs record...');
    const { data: lesson, error: insertError } = await supabase
      .from('lesson_costs')
      .insert({
        lesson_id: lessonId,
        user_id: user.id,
        scenario_type: scenarioType,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [DB ERROR]:', insertError);
      return NextResponse.json(
        { error: 'Failed to create lesson', details: insertError.message },
        { status: 500 }
      );
    }

    console.log('✅ [DB SUCCESS] Lesson created:', lesson.id);

    return NextResponse.json({
      lessonId,
      startedAt: new Date().toISOString(),
      demoMode: false
    });

  } catch (error: any) {
    console.error('❌ [UNEXPECTED ERROR]:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
