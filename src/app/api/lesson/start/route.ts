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

    // ---- Phase 1: status + usage-limit gate ----
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, plan, company_id')
      .eq('id', user.id)
      .single();

    if (profile?.status === 'revoked') {
      return NextResponse.json({ error: 'Your access has been revoked. Contact your administrator.', code: 'revoked' }, { status: 403 });
    }

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const countSince = async (since: string) => {
      const { count } = await supabase
        .from('lesson_costs')
        .select('lesson_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('started_at', since);
      return count || 0;
    };

    if (profile?.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('status, daily_practice_limit, monthly_practice_limit')
        .eq('id', profile.company_id)
        .single();
      if (company?.status === 'suspended') {
        return NextResponse.json({ error: 'Your company account is suspended.', code: 'company_suspended' }, { status: 403 });
      }
      if (company?.daily_practice_limit != null && (await countSince(startOfDay)) >= company.daily_practice_limit) {
        return NextResponse.json({ error: `Daily practice limit reached (${company.daily_practice_limit}/day).`, code: 'daily_limit' }, { status: 403 });
      }
      if (company?.monthly_practice_limit != null && (await countSince(startOfMonth)) >= company.monthly_practice_limit) {
        return NextResponse.json({ error: `Monthly practice limit reached (${company.monthly_practice_limit}/month).`, code: 'monthly_limit' }, { status: 403 });
      }
    } else if (profile?.plan !== 'premium') {
      // Read the current free limit from super-admin settings (live; no redeploy).
      const { data: settings } = await supabase.from('platform_settings').select('free_monthly_sessions').eq('id', 1).single();
      const freeLimit = settings?.free_monthly_sessions ?? 10;
      if ((await countSince(startOfMonth)) >= freeLimit) {
        return NextResponse.json({ error: `You've used your ${freeLimit} free sessions this month. Upgrade to Premium for unlimited practice.`, code: 'free_limit' }, { status: 403 });
      }
    }
    // ---- end gate ----

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
