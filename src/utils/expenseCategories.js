// Expense categories and subcategories based on the budget structure
const EXPENSE_CATEGORIES = {
  "fixed expenses": {
    type: "fixed",
    subcategories: {
      "rent": ["rent", "rental"],
      "emi": ["emi"]
    }
  },
  "variable expenses": {
    type: "variable",
    subcategories: {
      "home": ["water", "current bill", "gas", "home repair", "home needs"],
      "food & groceries": ["vegetables", "fruits/nuts", "provisions", "provisionals", "provisional", "non veg", "food", "online food", "tea/coffee/snacks"],
      "personal": ["insurance/subscriptions", "recharge", "clothes/slippers", "shopping/gift", "cosmetics", "ornaments", "self grooming", "gift"],
      "transportation": ["petrol", "vehicle service/wash", "auto/cab", "public transport", "parking charges"],
      "insurance": ["insurance"],
      "family": ["k fam", "v fam", "kaku", "vathu"],
      "entertainment": ["travel", "movie", "sports", "gym", "vacation/trips"],
      "savings": ["piggy bank", "bulk saving", "fd", "gold"],
      "medical": ["medical shop", "hospital"],
      "debt repayment": ["debt"]
    }
  },
  "other": {
    type: "other",
    subcategories: {
      "other": ["other"]
    }
  }
};

// Flatten all subcategories for easy lookup
const getAllSubcategories = () => {
  const subcats = {};
  Object.entries(EXPENSE_CATEGORIES).forEach(([mainCategory, categoryData]) => {
    Object.entries(categoryData.subcategories).forEach(([subCat, items]) => {
      if (Array.isArray(items)) {
        items.forEach(item => {
          subcats[item.toLowerCase()] = { mainCategory: mainCategory.toLowerCase(), subCategory: subCat.toLowerCase() };
        });
      } else {
        subcats[subCat.toLowerCase()] = { mainCategory: mainCategory.toLowerCase(), subCategory: subCat.toLowerCase() };
      }
    });
  });
  return subcats;
};

// Get the main category and type for a given subcategory
const getCategoryInfo = (subcategoryName) => {
  const subcats = getAllSubcategories();
  return subcats[subcategoryName?.toLowerCase()] || { mainCategory: "other", subCategory: "other" };
};

// Get formatted categories for frontend
const getFormattedCategories = () => {
  const formatted = [];
  Object.entries(EXPENSE_CATEGORIES).forEach(([mainCategory, categoryData]) => {
    const subCategoryList = [];
    Object.entries(categoryData.subcategories).forEach(([subCat, items]) => {
      if (Array.isArray(items)) {
        subCategoryList.push(...items);
      } else {
        subCategoryList.push(subCat);
      }
    });
    formatted.push({
      name: mainCategory,
      type: categoryData.type,
      subcategories: [...new Set(subCategoryList)]
    });
  });
  return [EXPENSE_CATEGORIES];
};

module.exports = {
  EXPENSE_CATEGORIES,
  getCategoryInfo,
  getFormattedCategories,
  getAllSubcategories
};
