// Vercel serverless proxy to VPS backend
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel rewrite passes original path as ?path=auth/login etc.
  const pathParam = req.query.path || '';
  const path = pathParam ? `/api/${pathParam}` : (req.url || '/');
  const target = `http://76.13.244.21:3002${path}`;

  const fetchHeaders = {
    'content-type': req.headers['content-type'] || 'application/json',
    'authorization': req.headers['authorization'] || '',
  };

  // Remove empty headers
  Object.keys(fetchHeaders).forEach(k => { if (!fetchHeaders[k]) delete fetchHeaders[k]; });

  let body = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  try {
    const response = await fetch(target, {
      method: req.method,
      headers: fetchHeaders,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = await response.text();

    res.setHeader('content-type', contentType);
    res.status(response.status).send(data);
  } catch (err) {
    res.status(502).json({ error: 'Backend unavailable', details: err.message });
  }
}
