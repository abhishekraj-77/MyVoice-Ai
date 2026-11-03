
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function testModel() {
  try {
    console.log("Testing Gemini Flash Lite...");

    const response = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: "Reply with exactly: MyVoice AI is working!",
    });

    console.log("\nSUCCESS!");
    console.log("Gemini response:", response.text);

  } catch (error) {
    console.error("\nMODEL TEST FAILED");
    console.error("Status:", error.status);
    console.error("Message:", error.message);
  }
}

testModel();

