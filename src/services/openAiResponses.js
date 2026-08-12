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

async function requestResponse(body, { timeoutMs = 60000, clientRequestId = requestId() } = {}) {
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
      const failure = new Error(data?.error?.message || data?.raw || `OpenAI returned ${response.status}`);
      failure.status = response.status;
      failure.openai_request_id = response.headers.get('x-request-id') || '';
      failure.client_request_id = clientRequestId;
      throw failure;
    }
    return { data, openai_request_id: response.headers.get('x-request-id') || '', client_request_id: clientRequestId };
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI request setup timed out after ${timeoutMs} ms`);
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
  maxOutputTokens = 7000,
  reasoningEffort = 'none',
  metadata = {},
  background = false
}) {
  const body = {
    model,
    reasoning: { effort: reasoningEffort },
    input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
    text: { format: responseFormat, verbosity: 'high' },
    max_output_tokens: maxOutputTokens,
    metadata,
    store: Boolean(background),
    background: Boolean(background)
  };
  const result = await requestResponse(body, { timeoutMs: background ? 60000 : 240000 });

  if (background) {
    if (!result.data?.id) throw new Error('OpenAI did not return a background response ID');
    return {
      response_id: result.data.id,
      status: result.data.status || 'queued',
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
    invalid.output_preview = text.slice(0, 1000);
    throw invalid;
  }
  return {
    output: parsed,
    response_id: result.data?.id || '',
    status: result.data?.status || 'completed',
    usage: result.data?.usage || null,
    openai_request_id: result.openai_request_id,
    client_request_id: result.client_request_id
  };
}

async function getResponse(responseId, { timeoutMs = 45000 } = {}) {
  if (!responseId) throw new Error('OpenAI response ID is required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'X-Client-Request-Id': requestId('divya-poll')
      }
    });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (error) { data = { raw }; }
    if (!response.ok) throw new Error(data?.error?.message || data?.raw || `OpenAI returned ${response.status}`);

    const status = data?.status || 'unknown';
    let output = null;
    if (status === 'completed') {
      const text = extractOutputText(data);
      if (!text) throw new Error('Completed OpenAI response contains no output text');
      output = JSON.parse(text);
    }
    return {
      response_id: data?.id || responseId,
      status,
      output,
      usage: data?.usage || null,
      error: data?.error || null,
      incomplete_details: data?.incomplete_details || null
    };
  } catch (error) {
    if (error.name === 'AbortError') throw new Error(`OpenAI status check timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createStructuredResponse, extractOutputText, getResponse, requestResponse };