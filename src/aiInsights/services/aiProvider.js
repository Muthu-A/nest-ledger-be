class AIProvider {
  async generate(prompt) {
    throw new Error("generate(prompt) must be implemented by a provider");
  }
}

module.exports = {
  AIProvider
};
