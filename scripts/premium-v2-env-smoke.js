function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Premium v2 environment is missing ${name}`);
  return value;
}

async function runEnvironmentSmoke() {
  requiredEnv('OPENAI_API_KEY');
  requiredEnv('SUPABASE_URL');
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!supabaseKey) {
    throw new Error('Premium v2 environment is missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }

  return {
    openai_key_present: true,
    supabase_url_present: true,
    supabase_server_key_present: true,
    paid_model: String(process.env.OPENAI_PAID_MODEL || 'gpt-5.5').trim()
  };
}

module.exports = { runEnvironmentSmoke };
