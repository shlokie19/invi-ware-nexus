import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, action } = await req.json();
    
    console.log(`Triggering model retrain for item: ${itemId}, action: ${action}`);

    // Call Flask backend to trigger model retraining
    const flaskUrl = `http://localhost:5000/train_model/${itemId}`;
    
    const response = await fetch(flaskUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action, // 'add', 'update', or 'delete'
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`Flask backend error: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to trigger model retrain: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Model retrain triggered successfully:', result);

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
    console.error('Error in trigger-model-retrain function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
