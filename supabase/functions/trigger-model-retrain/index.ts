import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLASK_API_URL = Deno.env.get('FLASK_API_URL') || 'http://localhost:5000';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, action } = await req.json();
    
    console.log(`Triggering model retrain for item: ${itemId}, action: ${action}`);

    // Check if Flask URL is localhost (won't work in cloud environment)
    if (FLASK_API_URL.includes('localhost') || FLASK_API_URL.includes('127.0.0.1')) {
      console.warn('⚠️ Flask API URL is localhost - edge functions cannot reach localhost');
      console.warn('💡 To fix: Deploy Flask or use ngrok to expose it publicly');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          message: 'ML retraining skipped - Flask backend must be publicly accessible',
          note: 'Set FLASK_API_URL environment variable to your public Flask URL, or use ngrok for local development'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Call Flask backend to trigger model retraining
    const flaskUrl = `${FLASK_API_URL}/train_model/${itemId}`;
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(flaskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Flask backend error: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to trigger model retrain: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Model retrain triggered successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Model retraining triggered',
        data: result 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('❌ Error in trigger-model-retrain function:', error);
    
    // Return success with warning so inventory operations aren't blocked
    return new Response(
      JSON.stringify({ 
        success: true,
        warning: 'ML retraining skipped - Flask backend not accessible',
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Inventory operation completed successfully. ML features require accessible Flask backend.'
      }),
      {
        status: 200, // Changed to 200 to not block inventory operations
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
