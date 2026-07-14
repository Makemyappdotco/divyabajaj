function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Premium v2 environment is missing ${name}`);
  return value;
}

async function runEnvironmentSmoke() {
  requiredEnv('OPENAI_API_KEY');
  requiredEnv('SUPABASE_URL');
  return {
    openai_key_present: true,
    supabase_url_present: true,
    paid_model: String(process.env.OPENAI_PAID_MODEL || 'gpt-5.5').trim()
  };
}

module.exports = { runEnvironmentSmoke };
