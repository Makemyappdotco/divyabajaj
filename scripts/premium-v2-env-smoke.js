const { createClient } = require('@supabase/supabase-js');

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Premium v2 environment is missing ${name}`);
  return value;
}

async function verifySupabase() {
  const url = requiredEnv('SUPABASE_URL');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!key) throw new Error('Premium v2 environment is missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const reportsCheck = await supabase.from('reports').select('id').limit(1);
  if (reportsCheck.error) {
    throw new Error(`Premium v2 cannot reach Supabase reports table: ${reportsCheck.error.message}`);
  }

  const bucketCheck = await supabase.storage.getBucket('premium-reports');
  if (bucketCheck.error || !bucketCheck.data) {
    const created = await supabase.storage.createBucket('premium-reports', { public: false });
    if (created.error && !String(created.error.message || '').toLowerCase().includes('already exists')) {
      throw new Error(`Premium v2 cannot prepare private storage bucket: ${created.error.message}`);
    }
  }

  return { reports_table: true, private_storage: true };
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

async function verifyOpenAI() {
  const apiKey = requiredEnv('OPENAI_API_KEY');
  const model = String(process.env.OPENAI_PAID_MODEL || 'gpt-5.5').trim();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: 'Return the word ready in the required JSON field.',
      max_output_tokens: 80,
      text: {
        format: {
          type: 'json_schema',
          name: 'premium_v2_environment_smoke',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              status: { type: 'string', enum: ['ready'] }
            },
            required: ['status']
          }
        }
      }
    })
  });

  const raw = await response.text();
  let envelope;
  try { envelope = raw ? JSON.parse(raw) : {}; }
  catch (error) { throw new Error(`OpenAI environment smoke returned an invalid envelope: ${raw.slice(0, 240)}`); }

  if (!response.ok) {
    throw new Error(envelope?.error?.message || `OpenAI environment smoke failed with ${response.status}`);
  }

  const output = extractOutputText(envelope);
  const parsed = JSON.parse(output);
  if (parsed.status !== 'ready') throw new Error('OpenAI environment smoke returned unexpected structured output');

  return { model, structured_output: true };
}

async function runEnvironmentSmoke() {
  const supabase = await verifySupabase();
  const openai = await verifyOpenAI();
  return { supabase, openai };
}

module.exports = { runEnvironmentSmoke };
