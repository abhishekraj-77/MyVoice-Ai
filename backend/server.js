
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, "data.json");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from the environment.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json());

let database = {
  expenses: [],
  tasks: [],
};

// -------------------------------
// DATABASE FUNCTIONS
// -------------------------------

async function loadData() {
  try {
    const content = await fs.readFile(DATA_FILE, "utf-8");
    const savedData = JSON.parse(content);

    database = {
      expenses: Array.isArray(savedData.expenses)
        ? savedData.expenses
        : [],
      tasks: Array.isArray(savedData.tasks)
        ? savedData.tasks
        : [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      await saveData();
    } else {
      throw error;
    }
  }
}

async function saveData() {
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(database, null, 2),
    "utf-8"
  );
}

// -------------------------------
// GEMINI AI WITH RETRY HANDLING
// -------------------------------

async function generateAIResponse(prompt) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Gemini request: attempt ${attempt}`);

      const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      return response.text;
    } catch (error) {
      console.error("Gemini error:", error.status, error.message);

      if (
        (error.status === 503 || error.status === 429) &&
        attempt < maxAttempts
      ) {
        const delay = attempt * 2000;
        console.log(`Retrying in ${delay / 1000} seconds...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Gemini AI is temporarily unavailable.");
}

// -------------------------------
// UNDERSTAND USER COMMAND
// -------------------------------

async function understandCommand(command) {
  const today = new Date().toISOString().split("T")[0];

  const prompt = `
You are the AI brain of MyVoice AI, a personal expense and task assistant.

Understand the user's command and return ONLY valid JSON.

Supported intents:

1. add_expense
2. add_task
3. show_expenses
4. show_tasks
5. show_total
6. complete_task
7. expense_insights
8. general

Return JSON in this format:

{
  "intent": "add_expense",
  "amount": 250,
  "category": "Food",
  "description": "Lunch",
  "date": "${today}",
  "task": "",
  "dueDate": "",
  "message": "Expense understood"
}

Rules:

- For expenses, extract amount, category, description and date.
- If the user says today or yesterday, interpret the date accordingly.
- If no expense date is mentioned, use today's date.
- For tasks, extract the task description and due date if mentioned.
- If the user asks to see expenses, use show_expenses.
- If the user asks to see tasks, use show_tasks.
- If the user asks for total spending across all time, use show_total.
- If the user asks to mark, finish, or complete a task, use complete_task.
- For complete_task, put the task name in the task field.
- If the user asks how much they spent in a particular category this month, use expense_insights.
- For expense_insights, put the category in category.
- If the user asks about spending across all categories this month, use expense_insights with an empty category.
- For unrelated or unclear commands, use general.
- Never invent an amount.
- Never invent a task name.
- Use INR as the currency.
- Return JSON only. No Markdown.

Today's date is: ${today}

User command: ${JSON.stringify(command)}
`;

  const result = await generateAIResponse(prompt);

  return JSON.parse(result);
}

// -------------------------------
// HEALTH CHECK
// -------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "MyVoice AI backend is running!",
    model: "gemini-flash-lite-latest",
    features: [
      "Voice expense tracking",
      "Task management",
      "Task completion",
      "Expense insights",
    ],
  });
});

// -------------------------------
// GET ALL SAVED DATA
// -------------------------------

app.get("/api/data", (req, res) => {
  res.json(database);
});

// -------------------------------
// PROCESS USER COMMAND
// -------------------------------

app.post("/api/command", async (req, res) => {
  try {
    const { command } = req.body;

    if (
      !command ||
      typeof command !== "string" ||
      !command.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid command.",
      });
    }

    console.log("User command:", command);

    const aiResult = await understandCommand(command);

    console.log("AI understood:", aiResult);

    let message =
      aiResult.message || "Command processed successfully.";

    let expense = null;
    let task = null;
    let total = 0;

    switch (aiResult.intent) {

      // ---------------------------
      // ADD EXPENSE
      // ---------------------------

      case "add_expense": {
        const amount = Number(aiResult.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({
            success: false,
            message: "I couldn't identify a valid expense amount.",
          });
        }

        expense = {
          id: Date.now().toString(),
          amount,
          category: aiResult.category || "Other",
          description: aiResult.description || "Expense",
          date: aiResult.date || new Date().toISOString().split("T")[0],
          createdAt: new Date().toISOString(),
        };

        database.expenses.push(expense);
        await saveData();

        message = `Successfully saved your expense of ₹${amount} for ${expense.description}.`;
        break;
      }

      // ---------------------------
      // ADD TASK
      // ---------------------------

      case "add_task": {
        const taskDescription = (
          aiResult.task || aiResult.description || ""
        ).trim();

        if (!taskDescription) {
          return res.status(400).json({
            success: false,
            message: "I couldn't understand the task description.",
          });
        }

        task = {
          id: Date.now().toString(),
          title: taskDescription,
          dueDate: aiResult.dueDate || null,
          completed: false,
          createdAt: new Date().toISOString(),
        };

        database.tasks.push(task);
        await saveData();

        message = `Your task has been added: ${task.title}.`;
        break;
      }

      // ---------------------------
      // SHOW EXPENSES
      // ---------------------------

      case "show_expenses": {
        message = database.expenses.length
          ? `You have ${database.expenses.length} saved expenses.`
          : "You have no expenses saved yet.";
        break;
      }

      // ---------------------------
      // SHOW TASKS
      // ---------------------------

      case "show_tasks": {
        const pendingTasks = database.tasks.filter(
          item => !item.completed
        ).length;

        const completedTasks = database.tasks.filter(
          item => item.completed
        ).length;

        message =
          `You have ${pendingTasks} pending tasks and ${completedTasks} completed tasks.`;
        break;
      }

      // ---------------------------
      // COMPLETE TASK BY VOICE
      // ---------------------------

      case "complete_task": {
        const requestedTask = (
          aiResult.task || ""
        ).toLowerCase().trim();

        if (!requestedTask) {
          message = "Please tell me which task you want to complete.";
          break;
        }

        const matchingTask = database.tasks.find(item => {
          const savedTitle = item.title.toLowerCase();

          return (
            !item.completed &&
            (
              savedTitle.includes(requestedTask) ||
              requestedTask.includes(savedTitle)
            )
          );
        });

        if (!matchingTask) {
          message = `I couldn't find an incomplete task matching ${requestedTask}.`;
          break;
        }

        matchingTask.completed = true;
        matchingTask.completedAt = new Date().toISOString();

        await saveData();

        task = matchingTask;

        message =
          `Great! Your task ${matchingTask.title} has been marked as completed.`;

        break;
      }

      // ---------------------------
      // SHOW ALL-TIME EXPENSE TOTAL
      // ---------------------------

      case "show_total": {
        total = database.expenses.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        message = `Your total recorded spending is ₹${total}.`;
        break;
      }

      // ---------------------------
      // SMART MONTHLY EXPENSE INSIGHTS
      // ---------------------------

      case "expense_insights": {
        const now = new Date();

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const requestedCategory = (
          aiResult.category || ""
        ).toLowerCase().trim();

        const filteredExpenses = database.expenses.filter(item => {
          const expenseDate = new Date(item.date);

          const isCurrentMonth =
            !Number.isNaN(expenseDate.getTime()) &&
            expenseDate.getMonth() === currentMonth &&
            expenseDate.getFullYear() === currentYear;

          const matchesCategory =
            !requestedCategory ||
            (item.category || "")
              .toLowerCase()
              .includes(requestedCategory);

          return isCurrentMonth && matchesCategory;
        });

        total = filteredExpenses.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        const categoryName =
          requestedCategory || "all categories";

        message =
          `You spent ₹${total} on ${categoryName} this month across ${filteredExpenses.length} transactions.`;

        break;
      }

      // ---------------------------
      // GENERAL COMMAND
      // ---------------------------

      default: {
        message =
          aiResult.message ||
          "Sorry, I couldn't understand that command. Please try again.";
      }
    }

    res.json({
      success: true,
      intent: aiResult.intent,
      message,
      expense,
      task,
      expenses: database.expenses,
      tasks: database.tasks,
      total,
    });

  } catch (error) {
    console.error("Command error:", error);

    res.status(500).json({
      success: false,
      message:
        error.status === 503 || error.status === 429
          ? "Gemini is temporarily busy. Please try again."
          : "Something went wrong while processing your command.",
    });
  }
});

// -------------------------------
// START SERVER
// -------------------------------

async function startServer() {
  try {
    await loadData();

    app.listen(PORT, () => {
      console.log(
        `MyVoice AI backend running at http://localhost:${PORT}`
      );

      console.log("AI Model: gemini-flash-lite-latest");
      console.log("Saved expenses:", database.expenses.length);
      console.log("Saved tasks:", database.tasks.length);
    });

  } catch (error) {
    console.error("Failed to start backend:", error);
    process.exit(1);
  }
}

startServer();
