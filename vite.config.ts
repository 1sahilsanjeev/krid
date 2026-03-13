import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'ai-proxy',
      configureServer(server) {
        server.middlewares.use('/ai', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              try {
                const { system, prompt, apiKey } = JSON.parse(body);

                if (!apiKey) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: { message: 'Missing API key' } }));
                  return;
                }

                const isGemini = apiKey.startsWith('AIza');

                if (isGemini) {
                  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
                  const geminiRes = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }]
                    })
                  });

                  const data: any = await geminiRes.json();

                  if (!geminiRes.ok) {
                    console.error('Gemini API Error:', JSON.stringify(data, null, 2));
                    res.statusCode = geminiRes.status;
                    res.end(JSON.stringify(data));
                    return;
                  }

                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ text }));
                } else {
                  // Anthropic Fallback
                  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': apiKey,
                      'anthropic-version': '2023-06-01',
                      'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                      model: 'claude-3-haiku-20240307',
                      max_tokens: 4096,
                      system: system || '',
                      messages: [{ role: 'user', content: prompt }],
                    }),
                  });

                  const data: any = await anthropicRes.json();

                  if (!anthropicRes.ok) {
                    console.error('Anthropic API Error:', JSON.stringify(data, null, 2));
                    res.statusCode = anthropicRes.status;
                    res.end(JSON.stringify(data));
                    return;
                  }

                  // Map Anthropic's response to the expected format
                  const text = data.content?.[0]?.text || '';
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ text }));
                }
              } catch (err: any) {
                console.error('AI Proxy Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: { message: err.message || 'Internal Server Error' } }));
              }
            });
          } else {
            res.statusCode = 405; // Method Not Allowed
            res.end();
          }
        });
      },
    },
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
