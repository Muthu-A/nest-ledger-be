// Expense categories and subcategories based on the budget structure
const EXPENSE_CATEGORIES = {
  "fixed expenses": {
    type: "fixed",
    subcategories: {
      "rent": ["rent", "rental", "house rent", "pg rent"],
      "emi & loans": ["emi", "home loan emi", "car loan emi", "personal loan emi", "bike emi"],
      "society maintenance": ["maintenance", "apartment maintenance", "society fee"],
      "school & tuition fees": ["school fee", "college fee", "tuition fee", "coaching fee", "term fee"],
      "subscriptions & dth": ["dth", "cable tv", "ott subscription", "netflix", "prime", "spotify", "newspaper", "magazine"]
    }
  },
  "variable expenses": {
    type: "variable",
    subcategories: {
      "food & groceries": [
        "vegetables", "fruits/nuts", "provisions", "provisionals", "provisional", 
        "non veg", "food", "online food", "tea/coffee/snacks", "groceries", 
        "milk/dairy", "swiggy/zomato", "dining out", "restaurant", "drinking water"
      ],
      "home & utilities": [
        "water", "current bill", "electricity bill", "gas", "lpg cylinder", 
        "home repair", "home needs", "internet/wifi", "maid/cook salary", 
        "laundry/dry clean", "cleaning supplies", "plumber/carpenter/electrician"
      ],
      "personal & grooming": [
        "insurance/subscriptions", "recharge", "mobile bill", "clothes/slippers", 
        "shopping/gift", "cosmetics", "ornaments", "self grooming", "gift", 
        "salon/spa/barber", "skincare", "apparel"
      ],
      "education & kids": [
        "books/stationery", "school bus", "uniform", "daycare/babysitter", 
        "kids activity", "toys", "baby needs"
      ],
      "transportation": [
        "petrol", "diesel", "ev charging", "vehicle service/wash", "auto/cab", 
        "public transport", "parking charges", "fastag/toll", "bus/train/flight ticket"
      ],
      "medical & health": [
        "medical shop", "pharmacy", "hospital", "doctor fee", "lab tests", 
        "dental", "spectacles/eyewear", "medicines"
      ],
      "insurance": [
        "health insurance", "life insurance", "vehicle insurance", "term insurance", "insurance"
      ],
      "family & social": [
        "k fam", "v fam", "kaku", "vathu", "family support", "elder care", 
        "wedding/functions", "festivals/pooja", "charity/donations"
      ],
      "entertainment & lifestyle": [
        "travel", "movie", "sports", "gym", "vacation/trips", "hobbies", 
        "outing/party", "gaming"
      ],
      "home & electronics shopping": [
        "electronics", "gadgets", "home appliances", "furniture", "home decor"
      ],
      "pets": [
        "pet food", "vet/doctor", "pet grooming", "pet supplies"
      ],
      "savings & investments": [
        "piggy bank", "bulk saving", "fd", "rd", "gold", "mutual funds/sip", 
        "stocks/equity", "ppf/nps", "chits"
      ],
      "debt repayment": [
        "debt", "credit card bill", "hand loan repayment", "borrowed money payback"
      ],
      "Legal & Professional Fees": ["lawyer fee", "notary", "ca fee", "consultant"],
      "Home Improvement / Renovation": ["renovation", "painting", "interior work"],
      "Vehicle Purchase / Down Payment": ["down payment", "vehicle registration"],
      "Travel / Vacation": ["flight tickets", "hotel booking", "travel packages"],
      "Gifts / Donations": ["charity", "donations", "gifts"],
      "Miscellaneous": ["miscellaneous", "other"]
    }
  },
  "other": {
    type: "other",
    subcategories: {
      "taxes & govt fees": ["property tax", "income tax", "water tax", "challan/fine", "document charges"],
      "other": ["other", "miscellaneous", "cash withdrawal", "unforeseen"]
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
