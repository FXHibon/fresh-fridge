import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import client from 'prom-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, initDb } from './db';

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
const JWT_SECRET = process.env.JWT_SECRET || 'fridge_jwt_secret_key_123';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Metrics collection middleware
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;

    let route = 'unknown';
    if (req.route) {
      route = req.route.path;
    } else if (req.path.startsWith('/api')) {
      route = req.path;
    } else {
      route = 'static_assets';
    }

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

// Authentication middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header is required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const checkUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, email: user.email },
      token
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Failed to authenticate.' });
  }
});

// Secure Inventory Routes
app.get('/api/fridge', authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, category, added_date AS "addedDate", expiry_date AS "expiryDate" FROM fridge_items WHERE user_id = $1 ORDER BY expiry_date ASC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching fridge items:', err);
    res.status(500).json({ error: 'Failed to fetch fridge items.' });
  }
});

app.post('/api/fridge', authMiddleware, async (req: any, res) => {
  try {
    const { name, category, addedDate, expiryDate } = req.body;
    if (!name || !category || !expiryDate) {
      return res.status(400).json({ error: 'Name, category, and expiryDate are required.' });
    }

    const result = await pool.query(
      'INSERT INTO fridge_items (user_id, name, category, added_date, expiry_date) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, category, added_date AS "addedDate", expiry_date AS "expiryDate"',
      [req.userId, name, category, addedDate || new Date().toISOString(), expiryDate]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding fridge item:', err);
    res.status(500).json({ error: 'Failed to add fridge item.' });
  }
});

app.delete('/api/fridge/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM fridge_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found or unauthorized.' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('Error deleting fridge item:', err);
    res.status(500).json({ error: 'Failed to delete fridge item.' });
  }
});

// Secure Saved Recipe Routes
app.get('/api/recipes/saved', authMiddleware, async (req: any, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, ingredients_used AS "ingredientsUsed", instructions, difficulty, saved_at AS "savedAt" FROM saved_recipes WHERE user_id = $1 ORDER BY saved_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching saved recipes:', err);
    res.status(500).json({ error: 'Failed to fetch saved recipes.' });
  }
});

app.post('/api/recipes/saved', authMiddleware, async (req: any, res) => {
  try {
    const { title, description, ingredientsUsed, instructions, difficulty } = req.body;
    if (!title || !description || !ingredientsUsed || !instructions || !difficulty) {
      return res.status(400).json({ error: 'All recipe fields are required.' });
    }

    const result = await pool.query(
      'INSERT INTO saved_recipes (user_id, title, description, ingredients_used, instructions, difficulty) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, description, ingredients_used AS "ingredientsUsed", instructions, difficulty, saved_at AS "savedAt"',
      [req.userId, title, description, ingredientsUsed, instructions, difficulty]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving recipe:', err);
    res.status(500).json({ error: 'Failed to save recipe.' });
  }
});

app.delete('/api/recipes/saved/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM saved_recipes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found or unauthorized.' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('Error deleting saved recipe:', err);
    res.status(500).json({ error: 'Failed to delete saved recipe.' });
  }
});

// Secure AI Recipe Route
app.post('/api/recipes', authMiddleware, async (req: any, res) => {
  try {
    const { items, lang } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Valid items array is required.' });
    }

    const isFrench = lang === 'fr';
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const ingredientsList = items.map(
      (item) => `${item.name} (${isFrench ? 'expire dans' : 'expires in'} ${item.daysUntilExpiry} ${isFrench ? 'jours' : 'days'})`
    ).join(', ');

    const prompt = isFrench
      ? `J'ai les ingrédients suivants dans mon réfrigérateur : ${ingredientsList}.
    Suggère 3 recettes simples et délicieuses que je peux préparer pour utiliser ces ingrédients, en donnant la priorité à ceux qui expirent le plus tôt.
    Retourne la réponse sous la forme d'un objet JSON valide avec une seule clé "recipes" contenant un tableau d'objets.
    Chaque objet doit avoir :
    - "title" (chaîne de caractères - titre de la recette en français)
    - "description" (chaîne de caractères - description en français)
    - "ingredientsUsed" (tableau de chaînes de caractères - ingrédients utilisés de la liste ci-dessus en français)
    - "instructions" (tableau de chaînes de caractères - instructions étape par étape en français)
    - "difficulty" (chaîne de caractères : "Easy", "Medium", ou "Hard" uniquement. N'utilise pas d'autres valeurs ni de traduction pour cette clé)
    N'inclus pas de formatage markdown ou de guillemets inversés (backticks) autour du JSON. Renvoie UNIQUEMENT la chaîne JSON brute.`
      : `I have the following ingredients in my fridge: ${ingredientsList}. 
    Suggest 3 simple, delicious recipes I can make to use up these ingredients, prioritizing the ones that expire soonest.
    Return the response as a valid JSON object with a single key "recipes" containing an array of objects.
    Each object should have:
    - "title" (string)
    - "description" (string)
    - "ingredientsUsed" (array of strings)
    - "instructions" (array of strings)
    - "difficulty" (string: Easy, Medium, Hard)
    Do not include markdown formatting or backticks around the JSON. Return ONLY the raw JSON string.`;

    console.info(`[Recipe API] Generating recipes using ${items.length} ingredients for user ${req.userId}...`);
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

// Secure Scan Route
app.post('/api/scan-groceries', authMiddleware, async (req: any, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

    console.info(`[Scan API] Analyzing grocery image for user ${req.userId}...`);
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
  // Initialize Database Pool and run tables migrations
  try {
    await initDb();
  } catch (err) {
    console.error('[Server] Failed to initialize database on startup. Exiting...', err);
    process.exit(1);
  }

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
