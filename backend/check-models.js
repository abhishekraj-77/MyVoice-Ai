
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function checkModels() {
  try {
    const result = await ai.models.list();

    const compatibleModels = [];

    for await (const model of result) {
      if (model.supportedActions?.includes("generateContent")) {
        compatibleModels.push(model.name);
      }
    }

    console.log("\nAVAILABLE GENERATION MODELS:\n");

    compatibleModels.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });

    console.log("\nTotal compatible models:", compatibleModels.length);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

checkModels();
