const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

async function testModel(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] }),
    });
    if (response.ok) {
      console.log(`✅ ${model} works`);
    } else {
      const err = await response.text();
      console.log(`❌ ${model} failed: ${err.substring(0, 100)}`);
    }
  } catch (e) {
    console.log(`❌ ${model} crashed: ${e.message}`);
  }
}

async function main() {
  for (const model of models) {
    await testModel(model);
  }
}

main();
