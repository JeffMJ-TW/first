
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const FALLBACK_CHEERS = [
  "太棒了！繼續保持喔！✨",
  "真厲害！離目標又更近一步了！🍀",
  "做的很好，你是最棒的！🌈",
  "好棒的表現，給自己一個掌聲！👏",
  "繼續努力，成功就在不遠處！🚀"
];

export const getCheerMessage = async (userName: string, stampCount: number): Promise<string> => {
  if (!process.env.API_KEY) return FALLBACK_CHEERS[Math.floor(Math.random() * FALLBACK_CHEERS.length)];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `User ${userName} just got their ${stampCount}th stamp out of 10. Give a very short, cute, and encouraging cheer in Traditional Chinese (Taiwan). Max 10 words. Use emojis.`,
      config: {
        temperature: 0.8,
        topP: 0.9,
      }
    });

    return response.text?.trim() || FALLBACK_CHEERS[0];
  } catch (error: any) {
    // Check for quota or other API errors
    console.warn("Gemini API Error (likely quota):", error?.message || error);
    return FALLBACK_CHEERS[Math.floor(Math.random() * FALLBACK_CHEERS.length)];
  }
};
