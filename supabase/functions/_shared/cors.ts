// Shared CORS headers for Supabase Edge Functions.
// Import in any function: import { corsHeaders } from '../_shared/cors.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

/**
 * Handle CORS preflight (OPTIONS) requests. Use at the top of every function:
 *
 *   if (req.method === 'OPTIONS') return handleCors()
 */
export function handleCors(): Response {
  return new Response(null, { headers: corsHeaders })
}
