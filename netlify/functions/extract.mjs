// Server-side proxy for the Gemini vision call.
// The API key lives only here (Netlify env var / local .env) — never in the browser bundle.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Tells Gemini to fill in any address missing a city/state/ZIP.
function locationHint(city, state, zip) {
  const parts = [
    city && `city "${city}"`,
    state && `state "${state}"`,
    zip && `ZIP code "${zip}"`,
  ].filter(Boolean);

  if (!parts.length) return '';
  return (
    ' If an address is missing the city, state, or ZIP code, complete it using ' +
    parts.join(', ') +
    '. Do not override values already present in the image.'
  );
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'Server is missing GEMINI_API_KEY' }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { base64, mimeType, city = '', state = '', zip = '' } = payload;
  if (!base64) {
    return json({ error: 'Missing image data' }, 400);
  }

  const body = {
    contents: [
      {
        parts: [
          {
            text:
              'Extract every mailing/street address visible in this image. ' +
              'Return them in the order they appear, one entry per stop, each on a single line. ' +
              'Ignore non-address text such as headers, names, phone numbers, or notes.' +
              locationHint(city.trim(), state.trim(), zip.trim()),
          },
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
    },
  };

  const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!geminiRes.ok) {
    const detail = await geminiRes.text();
    return json(
      { error: `Gemini request failed (${geminiRes.status})`, detail: detail.slice(0, 300) },
      502,
    );
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  let addresses;
  try {
    addresses = JSON.parse(text);
  } catch {
    addresses = [];
  }

  return json({ addresses: Array.isArray(addresses) ? addresses : [] });
};

// Netlify Functions 2.0 routing: requests to /api/extract hit this function.
export const config = { path: '/api/extract' };
