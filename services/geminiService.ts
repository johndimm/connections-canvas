import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GroupSuggestion } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    groups: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          groupName: { type: Type.STRING, description: "The short label for the connection (e.g. 'Types of Trees')" },
          words: { type: Type.ARRAY, items: { type: Type.STRING }, description: "The 4 words belonging to this group" },
          reasoning: { type: Type.STRING, description: "Brief explanation of why they connect" },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard", "Tricky"] }
        },
        required: ["groupName", "words", "reasoning", "difficulty"]
      }
    }
  },
  required: ["groups"]
};

export const getConnectionsHints = async (words: string[]): Promise<GroupSuggestion[]> => {
  try {
    const prompt = `
      Here are 16 words from a 'Connections' style puzzle. 
      Identify the 4 distinct groups of 4 words each. 
      The words are: ${words.join(", ")}.
      
      Return the answer in JSON format with 4 groups.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an expert puzzle solver specialized in NYT Connections games. You are accurate and concise.",
        temperature: 0.1, // Low temperature for deterministic solving
      }
    });

    const text = response.text;
    if (!text) return [];

    const data = JSON.parse(text);
    return data.groups || [];

  } catch (error) {
    console.error("Failed to get hints from Gemini:", error);
    throw error;
  }
};

export const extractWordsFromImage = async (base64Data: string, mimeType: string): Promise<string[]> => {
  try {
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
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text);
    return data.words || [];

  } catch (error) {
    console.error("Failed to extract words from image:", error);
    throw error;
  }
};
