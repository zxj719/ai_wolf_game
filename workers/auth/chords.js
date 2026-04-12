import { checkRateLimit, errorResponse, getCorsHeaders } from './middleware.js';

function getServiceBase(env) {
  const serviceUrl = (env.CHORDS_SERVICE_URL || '').trim().replace(/\/+$/, '');
  if (!serviceUrl) {
    throw new Error('CHORDS_SERVICE_URL is not configured.');
  }
  return serviceUrl;
}

function buildServiceHeaders(env, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  if (env.CHORDS_SERVICE_TOKEN) {
    headers.set('Authorization', `Bearer ${env.CHORDS_SERVICE_TOKEN}`);
  }
  return headers;
}

function encodeArtifactPath(artifactPath) {
  return artifactPath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function proxyServiceResponse(response, env, request) {
  const headers = new Headers(getCorsHeaders(env, request));
  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');

  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  if (contentDisposition) {
    headers.set('Content-Disposition', contentDisposition);
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function handleCreateChordsJob(request, env) {
  try {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = await checkRateLimit(env, `chords-upload:${clientIP}`, 6, 3600);
    if (!rateCheck.allowed) {
      return errorResponse(
        `Too many uploads. Please try again in ${rateCheck.retryAfter} seconds.`,
        429,
        env,
        request,
      );
    }

    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('multipart/form-data upload is required', 400, env, request);
    }

    const response = await fetch(`${getServiceBase(env)}/jobs`, {
      method: 'POST',
      headers: buildServiceHeaders(env, {
        'Content-Type': contentType,
      }),
      body: request.body,
    });

    return proxyServiceResponse(response, env, request);
  } catch (error) {
    console.error('Create chords job error:', error);
    return errorResponse(`Failed to create chords job: ${error.message}`, 500, env, request);
  }
}

export async function handleGetChordsJob(request, env, jobId) {
  try {
    const response = await fetch(`${getServiceBase(env)}/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      headers: buildServiceHeaders(env),
    });

    return proxyServiceResponse(response, env, request);
  } catch (error) {
    console.error('Get chords job error:', error);
    return errorResponse(`Failed to fetch chords job: ${error.message}`, 500, env, request);
  }
}

export async function handleGetChordsArtifact(request, env, jobId, artifactPath) {
  try {
    const response = await fetch(
      `${getServiceBase(env)}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeArtifactPath(artifactPath)}`,
      {
        method: 'GET',
        headers: buildServiceHeaders(env),
      },
    );

    return proxyServiceResponse(response, env, request);
  } catch (error) {
    console.error('Get chords artifact error:', error);
    return errorResponse(`Failed to fetch chords artifact: ${error.message}`, 500, env, request);
  }
}

export async function handleChordsHealth(request, env) {
  try {
    const response = await fetch(`${getServiceBase(env)}/health`, {
      method: 'GET',
      headers: buildServiceHeaders(env),
    });

    return proxyServiceResponse(response, env, request);
  } catch (error) {
    console.error('Chords health error:', error);
    return errorResponse(`Failed to reach chords service: ${error.message}`, 500, env, request);
  }
}
