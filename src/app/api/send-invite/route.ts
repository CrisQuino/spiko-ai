import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    // DEBUG: Log environment
    console.log('=== EMAIL SEND DEBUG ===');
    console.log('🔑 API Key exists:', !!process.env.RESEND_API_KEY);
    console.log('🔑 API Key length:', process.env.RESEND_API_KEY?.length || 0);
    console.log('🔑 API Key prefix:', process.env.RESEND_API_KEY?.substring(0, 10) || 'MISSING');
    
    // Validate API key first
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not found in environment variables');
      return NextResponse.json(
        { 
          error: 'Email service not configured',
          details: 'RESEND_API_KEY missing from environment variables. Add it to .env.local and restart server.'
        },
        { status: 500 }
      );
    }

    const { email, companyName, inviteUrl, role } = await req.json();
    
    // TESTING MODE: Controlled by EMAIL_TESTING_MODE environment variable
    // If EMAIL_TESTING_MODE is set: ALL emails go to that address
    // If EMAIL_TESTING_MODE is empty: emails go to actual recipients (production)
    const testingEmail = config.email.testingEmail;
    const TESTING_MODE = !!testingEmail;
    
    const emailTo = TESTING_MODE ? testingEmail : email;
    
    // DEBUG: Log request data
    console.log('📧 Original recipient:', email);
    if (TESTING_MODE) {
      console.log('⚠️  TESTING MODE ACTIVE');
      console.log('⚠️  EMAIL_TESTING_MODE is set');
      console.log('📬 Redirecting ALL emails to:', emailTo);
      console.log('💡 To disable: Remove EMAIL_TESTING_MODE from .env.local');
    } else {
      console.log('✅ PRODUCTION MODE');
      console.log('📬 Sending to actual recipient:', emailTo);
    }
    console.log('🏢 Company:', companyName);
    console.log('🔗 Invite URL:', inviteUrl);
    console.log('👤 Role:', role);

    // Validate inputs
    if (!email || !companyName || !inviteUrl) {
      console.error('❌ Missing required fields:', { 
        hasEmail: !!email, 
        hasCompany: !!companyName, 
        hasUrl: !!inviteUrl 
      });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Send email
    console.log('📤 Attempting to send email...');
    const { data, error } = await resend.emails.send({
      from: config.email.from,
      to: emailTo,
      subject: `${TESTING_MODE ? '[TEST] ' : ''}Join ${companyName} on SPEECK.AI! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 40px;
              text-align: center;
              color: white;
            }
            .content {
              background: white;
              border-radius: 8px;
              padding: 30px;
              margin-top: 20px;
              color: #333;
              text-align: left;
            }
            .button {
              display: inline-block;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 20px 0;
            }
            .info-box {
              background: #f8f9fa;
              border-left: 4px solid #667eea;
              padding: 15px;
              margin: 20px 0;
            }
            .warning-box {
              background: #fff3cd;
              border: 2px solid #ffc107;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 20px;
              color: #856404;
            }
            .footer {
              text-align: center;
              color: #666;
              font-size: 12px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
          </style>
        </head>
        <body>
          ${TESTING_MODE ? `
            <div class="warning-box">
              <strong>⚠️ TESTING MODE</strong><br>
              This email would have been sent to: <strong>${email}</strong><br>
              But was redirected to <strong>${emailTo}</strong> for testing purposes.<br>
              <small>To disable testing mode, remove EMAIL_TESTING_MODE from .env.local and restart server.</small>
            </div>
          ` : ''}
          
          <div class="container">
            <h1 style="margin: 0; font-size: 32px;">🎉 You're Invited!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Join your team on SPEECK.AI</p>
          </div>
          
          <div class="content">
            <h2 style="color: #667eea; margin-top: 0;">Welcome to SPEECK.AI</h2>
            
            <p>Hi there!</p>
            
            <p><strong>${companyName}</strong> has invited you to join their team as a <strong style="color: #667eea; text-transform: capitalize;">${role}</strong>.</p>
            
            <div class="info-box">
              <p style="margin: 0;"><strong>What is SPEECK.AI?</strong></p>
              <p style="margin: 10px 0 0 0;">Master technical English for production incidents through realistic simulations. Practice communication skills that IT engineers need in critical situations.</p>
            </div>
            
            <p>Click the button below to accept the invitation and create your account:</p>
            
            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">
                Accept Invitation & Join Team
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 12px; background: #f8f9fa; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${inviteUrl}
            </p>
            
            <div class="info-box">
              <p style="margin: 0; font-size: 14px;">⏰ <strong>Important:</strong> This invitation expires in 7 days.</p>
            </div>
            
            <p style="font-size: 14px; color: #666;">If you didn't expect this invitation or have any questions, please contact your team administrator.</p>
          </div>
          
          <div class="footer">
            <p><strong>SPEECK.AI</strong> - Master Technical English for Production Incidents</p>
            <p>This is an automated email. Please do not reply to this message.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend API error:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: 'Failed to send email', 
          details: error,
          apiKeyConfigured: !!process.env.RESEND_API_KEY,
          testingMode: TESTING_MODE
        },
        { status: 500 }
      );
    }

    console.log('✅ Email sent successfully! ID:', data?.id);
    if (TESTING_MODE) {
      console.log('⚠️  Email sent to testing address:', emailTo);
      console.log('⚠️  Original recipient was:', email);
    }
    
    return NextResponse.json({ 
      success: true, 
      emailId: data?.id,
      sentTo: emailTo,
      testingMode: TESTING_MODE,
      originalRecipient: TESTING_MODE ? email : undefined
    });
    
  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
