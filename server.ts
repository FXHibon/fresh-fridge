import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    res.json(JSON.parse(response.text() || '{"recipes": []}'));
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

    res.json(JSON.parse(response.text() || '{"items": []}'));
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
