const http = require("http");

/**
 * Test script for the Expense Dashboard endpoint
 * GET /api/expenses/dashboard?month=YYYY-MM
 * 
 * This tests the new expense aggregation endpoint that returns:
 * - Summary with total expenses, changes, averages, and highest expense
 * - Monthly trend data (last 6 months)
 * - Category breakdown for the selected month
 */

// Configuration
const API_HOST = "localhost";
const API_PORT = 5000;

// Test data - Replace with your actual auth token
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "your-jwt-token-here";

/**
 * Make HTTP request helper
 */
function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Run tests
 */
async function runTests() {
  console.log("🧪 Starting Expense Dashboard API Tests\n");
  console.log(`📌 Testing endpoint: GET /api/expenses/dashboard`);
  console.log(`📌 API Server: ${API_HOST}:${API_PORT}\n`);

  try {
    // Test 1: Get current month dashboard
    console.log("Test 1️⃣  - Current month expense dashboard");
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
    const response1 = await makeRequest("GET", `/api/expenses/dashboard?month=${currentMonth}`, {
      Authorization: `Bearer ${AUTH_TOKEN}`
    });

    console.log(`  Status: ${response1.status}`);
    if (response1.status === 200) {
      console.log(`  ✅ Success`);
      if (response1.body.data) {
        console.log(`  📊 Summary:`);
        console.log(`    - Total Expenses: $${response1.body.data.summary.totalExpenses}`);
        console.log(`    - Change %: ${response1.body.data.summary.expenseChangePercentage}%`);
        console.log(`    - Avg Monthly: $${response1.body.data.summary.averageMonthlyExpense}`);
        console.log(`    - Avg Change %: ${response1.body.data.summary.averageChangePercentage}%`);
        console.log(`    - Total Transactions: ${response1.body.data.summary.totalTransactions}`);
        console.log(`    - Highest Expense: $${response1.body.data.summary.highestExpense.amount} (${response1.body.data.summary.highestExpense.category})`);
        
        console.log(`\n  📈 Monthly Trend (${response1.body.data.monthlyTrend.length} months):`);
        response1.body.data.monthlyTrend.forEach(item => {
          console.log(`    - ${item.month}: $${item.expense} (${item.transactions} transactions)`);
        });

        console.log(`\n  🏷️  Category Breakdown:`);
        response1.body.data.categoryBreakdown.forEach(item => {
          console.log(`    - ${item.category}: $${item.amount} (${item.percentage}%)`);
        });
      }
    } else if (response1.status === 403) {
      console.log(`  ⚠️  Unauthorized (need valid JWT token)`);
      console.log(`  💡 Set TEST_AUTH_TOKEN environment variable with a valid JWT token`);
    } else {
      console.log(`  ❌ Error: ${response1.status}`);
      console.log(`  Response:`, response1.body);
    }

    // Test 2: Test with specific month (try previous month)
    console.log(`\n\nTest 2️⃣  - Specific month (previous month)`);
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const response2 = await makeRequest("GET", `/api/expenses/dashboard?month=${prevMonthStr}`, {
      Authorization: `Bearer ${AUTH_TOKEN}`
    });

    console.log(`  Status: ${response2.status}`);
    if (response2.status === 200) {
      console.log(`  ✅ Success for ${prevMonthStr}`);
      console.log(`    - Total Expenses: $${response2.body.data.summary.totalExpenses}`);
      console.log(`    - Total Transactions: ${response2.body.data.summary.totalTransactions}`);
    } else if (response2.status === 403) {
      console.log(`  ⚠️  Unauthorized`);
    } else {
      console.log(`  ❌ Error: ${response2.status}`);
    }

    // Test 3: Test invalid month format
    console.log(`\n\nTest 3️⃣  - Invalid month format`);
    const response3 = await makeRequest("GET", `/api/expenses/dashboard?month=invalid`, {
      Authorization: `Bearer ${AUTH_TOKEN}`
    });

    console.log(`  Status: ${response3.status}`);
    if (response3.status === 400) {
      console.log(`  ✅ Correctly rejected invalid format`);
    } else {
      console.log(`  Response:`, response3.body);
    }

    // Test 4: Test without auth token
    console.log(`\n\nTest 4️⃣  - Missing authentication`);
    const response4 = await makeRequest("GET", `/api/expenses/dashboard?month=${currentMonth}`, {});

    console.log(`  Status: ${response4.status}`);
    if (response4.status === 401 || response4.status === 403) {
      console.log(`  ✅ Correctly rejected unauthenticated request`);
    } else {
      console.log(`  Response:`, response4.body);
    }

    console.log("\n\n✨ Tests completed!\n");
  } catch (error) {
    console.error("❌ Test Error:", error.message);
    console.log("\n💡 Make sure the server is running: npm run dev");
  }
}

// Run the tests
runTests();
