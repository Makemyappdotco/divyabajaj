async function runEnvironmentSmoke() {
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  if (!supabaseKey) {
    throw new Error('Premium v2 environment is missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }

  return {
    supabase_server_key_present: true
  };
}

module.exports = { runEnvironmentSmoke };
