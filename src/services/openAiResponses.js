const crypto = require('crypto');

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');
  return apiKey;
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (Array.isArray(data?.output) ? data.output : [])
    .flatMap(item => Array.isArray(item?.content) ? item.content : [])
    .filter(item => item?.type === 'output_text' || typeof item?.text === 'string')
    .map(item => item?.text || '')
    .join('\n')
    .trim();
}

function requestId(prefix = 'divya') {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function requestResponse(body, { timeoutMs = 240000, clientRequestId = requestId() } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`,
        'X-Client-Request-Id': clientRequestId
      },
      body: JSON.stringify(body)
    });

    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { data = { raw }; }

    if (!response.ok) {
      const message = data?.error?.message || data?.raw || `OpenAI returned ${response.status}`;
      const failure = new Error(message);
      failure.status = response.status;
      failure.openai_request_id = response.headers.get('x-request-id') || '';
      failure.client_request_id = clientRequestId;
      throw failure;
    }

    return {
      data,
      openai_request_id: response.headers.get('x-request-id') || '',
      client_request_id: clientRequestId
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI response timed out after ${timeoutMs} ms`);
      timeoutError.client_request_id = clientRequestId;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function createStructuredResponse({
  model,
  prompt,
  responseFormat,
  maxOutputTokens = 12000,
  reasoningEffort = 'none',
  metadata = {},
  store = false,
  background = false,
  timeoutMs
}) {
  if (!model) throw new Error('OpenAI model is required');
  if (!prompt) throw new Error('OpenAI prompt is required');
  if (!responseFormat) throw new Error('Structured response format is required');

  const body = {
    model,
    reasoning: { effort: reasoningEffort },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: prompt }
        ]
      }
    ],
    text: {
      format: responseFormat,
      verbosity: 'high'
    },
    max_output_tokens: maxOutputTokens,
    metadata,
    store,
    background
  };

  const result = await requestResponse(body, { timeoutMs: timeoutMs || (background ? 60000 : 240000) });
  if (background) {
    return {
      response_id: result.data?.id || '',
      status: result.data?.status || 'queued',
      raw: result.data,
      openai_request_id: result.openai_request_id,
      client_request_id: result.client_request_id
    };
  }

  const text = extractOutputText(result.data);
  if (!text) throw new Error('OpenAI returned no structured output text');

  let parsed;
  try { parsed = JSON.parse(text); }
  catch (error) {
    const invalid = new Error('OpenAI structured output was not valid JSON');
    invalid.cause = error;
    invalid.output_preview = text.slice(0, 1000);
    throw invalid;
  }

  return {
    output: parsed,
    response_id: result.data?.id || '',
    status: result.data?.status || 'completed',
    usage: result.data?.usage || null,
    raw: result.data,
    openai_request_id: result.openai_request_id,
    client_request_id: result.client_request_id
  };
}

async function getResponse(responseId, { timeoutMs = 60000 } = {}) {
  if (!responseId) throw new Error('OpenAI response ID is required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const clientRequestId = requestId('divya-poll');

  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'X-Client-Request-Id': clientRequestId
      }
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { data = { raw }; }

    if (!response.ok) throw new Error(data?.error?.message || data?.raw || `OpenAI returned ${response.status}`);

    const text = extractOutputText(data);
    let output = null;
    if (text && data?.status === 'completed') output = JSON.parse(text);

    return {
      response_id: data?.id || responseId,
      status: data?.status || 'unknown',
      output,
      usage: data?.usage || null,
      error: data?.error || null,
      incomplete_details: data?.incomplete_details || null,
      raw: data
    };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`OpenAI response poll timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  createStructuredResponse,
  extractOutputText,
  getResponse,
  requestId,
  requestResponse
};