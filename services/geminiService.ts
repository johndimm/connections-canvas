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

const fetchPuzzleForDate = async (date: string) => {
  const response = await fetch(`/api/nyt/svc/connections/v2/${date}.json`);
  if (!response.ok) throw new Error(`NYT API returned ${response.status}`);
  return response.json();
};

export const fetchDailyPuzzle = async (dayOffset = 0): Promise<{ words: string[], puzzleDate: string }> => {
  const now = new Date();
  now.setDate(now.getDate() + dayOffset);
  // Use local date to avoid requesting "tomorrow's" puzzle for West Coast users in the evening
  const puzzleDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const data = await fetchPuzzleForDate(puzzleDate);
  const allCards: { content: string; position: number }[] = data.categories.flatMap(
    (cat: { cards: { content: string; position: number }[] }) => cat.cards
  );
  allCards.sort((a, b) => a.position - b.position);
  const words = allCards.map(card => card.content).filter(Boolean);
  return { words, puzzleDate };
};