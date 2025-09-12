import { NextRequest, NextResponse } from 'next/server';

interface DinstarSendRequest {
  recipient: string;
  message: string;
  template_id?: string;
  simPort?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: DinstarSendRequest = await request.json();
    const { recipient, message, template_id, simPort } = body;

    if (!recipient || !message) {
      return NextResponse.json({
        success: false,
        message: 'Recipient and message are required'
      }, { status: 400 });
    }

    // For now, simulate Dinstar SMS sending
    // In production, this would use actual Dinstar configuration from database
    const success = Math.random() > 0.2; // 80% success rate for demo
    
    const smsLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      direction: 'outbound' as const,
      recipient: recipient,
      message: message,
      provider: 'dinstar',
      provider_message_id: success ? `dinstar_${Date.now()}` : undefined,
      status: success ? 'sent' as const : 'failed' as const,
      error_message: success ? undefined : 'Dinstar gateway connection error - check configuration',
      template_id: template_id,
      message_type: 'original' as const,
      cost: success ? 0.02 : undefined, // Cost in EUR
      currency: 'EUR',
      sim_port: simPort || 1,
      sent_at: success ? new Date().toISOString() : undefined,
      failed_at: success ? undefined : new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully via Dinstar',
        data: smsLog
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Dinstar SMS sending failed',
        data: smsLog
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('SMS send error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error: ' + error.message
    }, { status: 500 });
  }
}