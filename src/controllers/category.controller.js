const { getFormattedCategories } = require("../utils/expenseCategories");

exports.getCategories = async (req, res) => {
  try {
    const categories = getFormattedCategories();
    res.json({ categories });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};
