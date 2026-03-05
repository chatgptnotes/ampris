// Vercel serverless function — just proxies to backend /api/sld/queue (returns jobId instantly)
// Backend handles the slow OpenAI call asynchronously
export const maxDuration = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Forward JSON body to backend queue endpoint (returns immediately with jobId)
    const backendRes = await fetch('http://76.13.244.21:3002/api/sld/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers['authorization'] || '',
      },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(25000), // 25s — well within Vercel's 30s limit
    });

    const data = await backendRes.json();
    return res.status(backendRes.status).json(data);
  } catch (err) {
    console.error('SLD queue proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
