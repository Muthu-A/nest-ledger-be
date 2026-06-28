const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Expense = require("./src/models/Expense");

dotenv.config();

const migrateExpensesToLowercase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Update all expenses to have lowercase category
    const result = await Expense.updateMany(
      {},
      [
        {
          $set: {
            category: {
              $toLower: "$category"
            }
          }
        }
      ],
      { updatePipeline: true }
    );

    console.log(`Migration completed. Updated ${result.modifiedCount} expenses.`);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

migrateExpensesToLowercase();
