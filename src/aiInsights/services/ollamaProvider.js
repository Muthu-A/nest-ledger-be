const { DEFAULT_MODEL } = require("../types");
const { AIProvider } = require("./aiProvider");

class OllamaProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    this.model = options.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  }

  async generate(prompt) {
    const requestBody = {
      model: this.model,
      prompt,
      stream: false
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("=== AI PROVIDER DEBUG ===");
      console.log("Exact request body sent to Ollama:");
      console.log(JSON.stringify(requestBody, null, 2));
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.response || "";
    if (process.env.NODE_ENV !== "production") {
      console.log("Raw AI response from Ollama:");
      console.log(rawResponse);
    }
    return rawResponse;
  }
}

module.exports = {
  OllamaProvider
};
