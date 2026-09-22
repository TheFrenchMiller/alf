import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve("../mcp-servers/.env") });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM = `Tu es Alf, l'assistant personnel autonome d'Erwan (The French Miller / WARM-TV / Wearerockmetal).
Ta mission : l'épauler dans sa communication numérique, ses relations presse (secteur musical/métal), la gestion de ses trois comptes email, et à terme ses projets de développement web et ses réseaux sociaux.
Réponds en français, de manière concise et actionnable.`;

async function test(label, fn) {
  const start = Date.now();
  try {
    const response = await fn();
    const elapsed = Date.now() - start;
    console.log(`✅ ${label} → ${elapsed}ms → "${response.text?.slice(0, 40)}"`);
  } catch (error) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${label} → ${elapsed}ms → ${error.message}`);
  }
}

async function main() {
  // Test 1 : modèle seul, sans system instruction
  await test("3.1-flash-lite SANS system", () =>
    ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: "Bonjour",
    })
  );

  // Test 2 : modèle seul, avec system instruction
  await test("3.1-flash-lite AVEC system", () =>
    ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: "Bonjour",
      config: { systemInstruction: SYSTEM },
    })
  );

  // Test 3 : chat avec system (comme l'orchestrateur)
  await test("3.1-flash-lite chat session", async () => {
    const chat = ai.chats.create({
      model: "gemini-3.1-flash-lite",
      config: { systemInstruction: SYSTEM },
    });
    return chat.sendMessage({ message: "Bonjour" });
  });

  // Test 4 : autre modèle
  await test("3.6-flash SANS system", () =>
    ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: "Bonjour",
    })
  );
}

main();