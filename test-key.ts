import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ Error: GEMINI_API_KEY is not defined in the .env file.');
  process.exit(1);
}

console.log('🔄 Initializing GoogleGenAI client...');
const ai = new GoogleGenAI({ apiKey });

async function testApiKey() {
  try {
    console.log('📡 Sending test request to gemini-3.5-flash...');
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: 'Hello! Please reply with "API key is valid!".',
    });

    console.log('\n✨ Response from Gemini:');
    console.log(response.text);
    console.log('\n✅ Success! Your GEMINI_API_KEY is valid and working.');
  } catch (error) {
    console.error('\n❌ Error: Failed to generate content.');
    console.error(error);
  }
}

testApiKey();
