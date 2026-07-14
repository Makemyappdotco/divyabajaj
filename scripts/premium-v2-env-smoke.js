function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Premium v2 environment is missing ${name}`);
  return value;
}

function extractOutputText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data.output || [])
    .flatMap(item => item.content || [])
    .map(item => item.text || '')
    .join('\n')
    .trim();
}

async function runEnvironmentSmoke() {
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
      input: 'Return ready in the required JSON field.',
      max_output_tokens: 80,
      text: {
        format: {
          type: 'json_schema',
          name: 'premium_v2_openai_smoke',
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
  catch (error) { throw new Error(`OpenAI smoke returned an invalid response envelope: ${raw.slice(0, 240)}`); }

  if (!response.ok) {
    throw new Error(envelope?.error?.message || `OpenAI smoke failed with ${response.status}`);
  }

  const output = extractOutputText(envelope);
  const parsed = JSON.parse(output);
  if (parsed.status !== 'ready') throw new Error('OpenAI smoke returned unexpected structured output');

  return { openai_key_present: true, paid_model: model, structured_output: true };
}

module.exports = { runEnvironmentSmoke };
