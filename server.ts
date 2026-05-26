import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import client from 'prom-client';

// Enable default metrics collection (CPU, Memory, etc.)
client.collectDefaultMetrics();

// Define a histogram for HTTP request durations
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Counter for request totals
const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const app = express();
const PORT = 3000;
const isDebug = process.env.LOG_LEVEL === 'DEBUG';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Metrics collection middleware
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    // Use req.route.path if available (e.g. /api/recipes).
    // If not (Vite routes, static files, 404s), use req.path for API routes,
    // and a generic bucket for static assets to keep metric cardinality low.
    let route = 'unknown';
    if (req.route) {
      route = req.route.path;
    } else if (req.path.startsWith('/api')) {
      route = req.path;
    } else {
      route = 'static_assets';
    }

    // Exclude /metrics endpoint itself from stats to avoid telemetry loops
    if (req.path === '/metrics') {
      return;
    }

    httpRequestDurationSeconds
      .labels(req.method, route, res.statusCode.toString())
      .observe(durationInSeconds);

    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });

  next();
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

app.post('/api/recipes', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Valid items array is required.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const ingredientsList = items.map(
      (item) => `${item.name} (expires in ${item.daysUntilExpiry} days)`
    ).join(', ');

    const prompt = `I have the following ingredients in my fridge: ${ingredientsList}. 
    Suggest 3 simple, delicious recipes I can make to use up these ingredients, prioritizing the ones that expire soonest.
    Return the response as a valid JSON object with a single key "recipes" containing an array of objects.
    Each object should have:
    - "title" (string)
    - "description" (string)
    - "ingredientsUsed" (array of strings)
    - "instructions" (array of strings)
    - "difficulty" (string: Easy, Medium, Hard)
    Do not include markdown formatting or backticks around the JSON. Return ONLY the raw JSON string.`;

    console.info(`[Recipe API] Generating recipes using ${items.length} ingredients...`);
    if (isDebug) {
      console.debug('[Recipe API] Full Prompt:', prompt);
      console.debug('[Recipe API] Ingredients payload:', ingredientsList);
    }
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const duration = Date.now() - startTime;
    const responseText = response.text || '{"recipes": []}';
    console.info(`[Recipe API] Successfully generated recipes in ${duration}ms.`);
    if (isDebug) {
      console.debug('[Recipe API] Full LLM Response payload:', responseText);
    }

    res.json(JSON.parse(responseText));
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to generate recipes' });
  }
});

app.post('/api/scan-groceries', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Extract base64 part, removing data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this image of groceries. Identify all the food/grocery items visible.
    For each item, provide:
    1. A clear product name.
    2. The most appropriate category from this exact list: ["Produce", "Dairy", "Meat", "Pantry", "Other"].
    3. An estimate of how many days until it expires (an integer number).
    
    Return the response as a valid JSON object with a single key "items" containing an array of objects.
    Each object should have:
    - "name" (string)
    - "category" (string)
    - "expiryDays" (number)
    
    Do not include markdown formatting or backticks around the JSON. Return ONLY the raw JSON string.`;

    console.info('[Scan API] Analyzing grocery image...');
    if (isDebug) {
      console.debug('[Scan API] Image base64 length:', base64Data.length);
    }
    const startTime = Date.now();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const duration = Date.now() - startTime;
    const responseText = response.text || '{"items": []}';
    console.info(`[Scan API] Successfully analyzed image in ${duration}ms.`);
    if (isDebug) {
      console.debug('[Scan API] Full LLM Response payload:', responseText);
    }

    res.json(JSON.parse(responseText));
  } catch (error) {
    console.error('Error scanning groceries:', error);
    res.status(500).json({ error: 'Failed to analyze grocery image' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
