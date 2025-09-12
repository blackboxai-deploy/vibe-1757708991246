import { NextRequest, NextResponse } from 'next/server';

interface DinstarConfig {
  baseUrl: string;
  port: number;
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, port, username, password }: DinstarConfig = body;

    if (!baseUrl || !port || !username || !password) {
      return NextResponse.json({
        success: false,
        message: 'Missing required configuration parameters'
      }, { status: 400 });
    }

    // Clean up the base URL - remove trailing slash and ensure http/https
    let cleanBaseUrl = baseUrl.trim();
    if (!cleanBaseUrl.startsWith('http://') && !cleanBaseUrl.startsWith('https://')) {
      cleanBaseUrl = `http://${cleanBaseUrl}`;
    }
    cleanBaseUrl = cleanBaseUrl.replace(/\/$/, ''); // Remove trailing slash

    // Test connection to Dinstar gateway using proper API endpoint
    // Based on Dinstar API doc: POST /api/login with form data or JSON
    const loginUrl = `${cleanBaseUrl}:${port}/api/login`;
    
    console.log('Testing Dinstar connection to:', loginUrl);
    console.log('Credentials:', { username, password: '***' });

    try {
      // Try multiple authentication methods as per Dinstar documentation
      
      // Method 1: Try with form data (most common for Dinstar)
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      let response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'CRM-SMS-Module/1.0'
        },
        body: formData,
        signal: AbortSignal.timeout(15000) // 15 second timeout
      });

      // If form data fails, try JSON
      if (!response.ok && response.status === 400) {
        console.log('Form data failed, trying JSON...');
        response = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'CRM-SMS-Module/1.0'
          },
          body: JSON.stringify({
            username: username,
            password: password
          }),
          signal: AbortSignal.timeout(15000)
        });
      }

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response body:', errorText);
        
        return NextResponse.json({
          success: false,
          message: `Connection failed: HTTP ${response.status} - ${response.statusText}. Check gateway IP, port, and credentials.`,
          debug: {
            url: loginUrl,
            status: response.status,
            statusText: response.statusText,
            body: errorText.substring(0, 200) // First 200 chars for debugging
          }
        }, { status: 500 });
      }

      const responseText = await response.text();
      console.log('Response body:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        // If not JSON, check if it's a success response
        if (responseText.includes('success') || responseText.includes('ok') || response.status === 200) {
          return NextResponse.json({
            success: true,
            message: 'Connection successful - Gateway responded',
            data: {
              response: responseText,
              status: response.status
            }
          });
        }
        
        return NextResponse.json({
          success: false,
          message: 'Gateway returned non-JSON response',
          debug: {
            response: responseText,
            status: response.status
          }
        }, { status: 500 });
      }

      // Check various success indicators from Dinstar API
      const isSuccess = result.result === 'ok' || 
                       result.status === 'success' || 
                       result.success === true ||
                       result.code === 200 ||
                       result.token;

      if (isSuccess) {
        return NextResponse.json({
          success: true,
          message: 'Connection successful',
          data: {
            token: result.token || 'no-token',
            gateway_version: result.gateway_version || result.version || 'Unknown',
            result: result
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          message: result.reason || result.message || result.error || 'Authentication failed',
          debug: {
            result: result
          }
        }, { status: 401 });
      }

    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          message: 'Connection timeout - Gateway not responding. Check IP address and port.',
          debug: {
            url: loginUrl,
            error: 'timeout'
          }
        }, { status: 408 });
      }

      // Network errors
      if (fetchError.code === 'ECONNREFUSED' || fetchError.message.includes('ECONNREFUSED')) {
        return NextResponse.json({
          success: false,
          message: 'Connection refused - Gateway not accessible. Check IP address and port.',
          debug: {
            url: loginUrl,
            error: fetchError.message
          }
        }, { status: 500 });
      }

      throw fetchError; // Re-throw to be caught by outer catch
    }

  } catch (error: any) {
    console.error('Dinstar connection test error:', error);
    
    return NextResponse.json({
      success: false,
      message: `Connection error: ${error.message}`,
      debug: {
        error: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500)
      }
    }, { status: 500 });
  }
}