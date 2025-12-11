import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GroupSuggestion } from "../types";

const getAI = () => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("API Key is missing. Please add API_KEY to your environment variables.");
  }
  return new GoogleGenAI({ apiKey: key });
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          groupName: { type: Type.STRING },
          words: { type: Type.ARRAY, items: { type: Type.STRING } },
          reasoning: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard", "Tricky"] }
        },
        required: ["groupName", "words", "reasoning", "difficulty"]
      }
    }
  },
  required: ["groups"]
};

// Schema for fetching just the words
const wordsListSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    words: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "The list of exactly 16 words found in the puzzle grid."
    }
  },
  required: ["words"]
};

export const getConnectionsHints = async (words: string[]): Promise<GroupSuggestion[]> => {
  try {
    const ai = getAI();
    const prompt = `
      Here are 16 words from a 'Connections' style puzzle. 
      Identify the 4 distinct groups of 4 words each. 
      The words are: ${words.join(", ")}.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, 
      }
    });

    const data = JSON.parse(response.text || "{}");
    return data.groups || [];

  } catch (error) {
    console.error("Failed to get hints from Gemini:", error);
    throw error;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
    const ai = getAI();
    const prompt = `
      Analyze this image of a NYT Connections puzzle board.
      Extract the 16 distinct words visible on the tiles.
      Return ONLY the list of 16 words.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: wordsListSchema
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    return data.words || [];

  } catch (error) {
    console.error("Failed to extract words from image:", error);
    throw error;
  }
};

export const fetchDailyPuzzle = async (): Promise<{ words: string[], source?: string }> => {
  try {
    const ai = getAI();
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    const prompt = `
      Find the New York Times Connections puzzle for today, ${date}.
      Return the 16 words from the grid.
      Output valid JSON in this format: { "words": ["WORD1", "WORD2", ...] }
      Do not include any other text.
    `;

    // Note: When using tools (googleSearch), we CANNOT use responseMimeType or responseSchema.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    let words: string[] = [];

    try {
        // Attempt to parse JSON directly, cleaning potential markdown code blocks
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
        const data = JSON.parse(cleanText);
        
        if (data.words && Array.isArray(data.words)) {
            words = data.words;
        } else if (Array.isArray(data)) {
            words = data;
        }
    } catch (e) {
        // Fallback: Try to find a JSON object or array pattern in the text
        const arrayMatch = text.match(/\[.*\]/s);
        const objectMatch = text.match(/\{.*\}/s);
        
        try {
            if (objectMatch) {
                 const data = JSON.parse(objectMatch[0]);
                 if (data.words) words = data.words;
            } else if (arrayMatch) {
                 words = JSON.parse(arrayMatch[0]);
            }
        } catch (e2) {}
    }

    // SANITIZATION
    words = words.flat();
    words = words.map(w => String(w).trim().toUpperCase());
    words = words.filter(w => 
        w.length > 0 && 
        w.length < 25 &&
        !w.includes("THE WORDS") && 
        !w.includes("PUZZLE") &&
        !w.includes("HTTP")
    );
    const finalWords = [...new Set(words)].slice(0, 16);
    
    return { words: finalWords };

  } catch (error) {
    console.error("Failed to fetch daily puzzle:", error);
    throw error;
  }
};