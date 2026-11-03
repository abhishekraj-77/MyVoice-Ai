
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  authenticateUser,
  getUserSupabaseClient,
} from "./supabase.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from the environment.");
}

if (
  !process.env.SUPABASE_URL ||
  !process.env.SUPABASE_PUBLISHABLE_KEY
) {
  throw new Error("Supabase environment variables are missing.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(cors());
app.use(express.json());

// ----------------------------------
// AUTHENTICATION MIDDLEWARE
// ----------------------------------

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Please log in to continue.",
      });
    }

    const token = authHeader.slice(7);

    const user = await authenticateUser(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session. Please log in again.",
      });
    }

    req.user = user;
    req.supabase = getUserSupabaseClient(token);

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
}

// ----------------------------------
// GEMINI AI WITH RETRY HANDLING
// ----------------------------------

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

// ----------------------------------
// UNDERSTAND USER COMMAND
// ----------------------------------

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
- If the user asks about spending in a particular category this month, use expense_insights.
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

// ----------------------------------
// FORMAT DATABASE ROWS FOR FRONTEND
// ----------------------------------

function formatExpense(item) {
  return {
    id: item.id,
    amount: Number(item.amount),
    category: item.category,
    description: item.description,
    date: item.date,
    createdAt: item.created_at,
  };
}

function formatTask(item) {
  return {
    id: item.id,
    title: item.title,
    dueDate: item.due_date,
    completed: item.completed,
    createdAt: item.created_at,
    completedAt: item.completed_at,
  };
}

// ----------------------------------
// HEALTH CHECK
// ----------------------------------

app.get("/", (req, res) => {
  res.json({
    message: "MyVoice AI backend is running!",
    model: "gemini-flash-lite-latest",
    database: "Supabase PostgreSQL",
    authentication: "Supabase Auth",
    features: [
      "User authentication",
      "Voice expense tracking",
      "Task management",
      "Task completion",
      "Expense insights",
      "User-specific data",
    ],
  });
});

// ----------------------------------
// GET LOGGED-IN USER'S DATA
// ----------------------------------

app.get("/api/data", requireAuth, async (req, res) => {
  try {
    const { data: expenseRows, error: expenseError } =
      await req.supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

    if (expenseError) throw expenseError;

    const { data: taskRows, error: taskError } =
      await req.supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

    if (taskError) throw taskError;

    res.json({
      expenses: expenseRows.map(formatExpense),
      tasks: taskRows.map(formatTask),
    });
  } catch (error) {
    console.error("Dashboard data error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load your saved data.",
    });
  }
});

// ----------------------------------
// PROCESS AUTHENTICATED USER COMMAND
// ----------------------------------

app.post("/api/command", requireAuth, async (req, res) => {
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

    console.log("User:", req.user.id);
    console.log("Command:", command);

    const aiResult = await understandCommand(command);

    console.log("AI understood:", aiResult);

    let message =
      aiResult.message || "Command processed successfully.";

    let expense = null;
    let task = null;
    let total = 0;

    let expenses = [];
    let tasks = [];

    // ----------------------------------
    // ADD EXPENSE
    // ----------------------------------

    switch (aiResult.intent) {
      case "add_expense": {
        const amount = Number(aiResult.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
          return res.status(400).json({
            success: false,
            message: "I couldn't identify a valid expense amount.",
          });
        }

        const { data, error } = await req.supabase
          .from("expenses")
          .insert({
            user_id: req.user.id,
            amount,
            category: aiResult.category || "Other",
            description: aiResult.description || "Expense",
            date:
              aiResult.date ||
              new Date().toISOString().split("T")[0],
          })
          .select()
          .single();

        if (error) throw error;

        expense = formatExpense(data);

        message =
          `Successfully saved your expense of ₹${amount} for ${expense.description}.`;

        break;
      }

      // ----------------------------------
      // ADD TASK
      // ----------------------------------

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

        const { data, error } = await req.supabase
          .from("tasks")
          .insert({
            user_id: req.user.id,
            title: taskDescription,
            due_date: aiResult.dueDate || null,
            completed: false,
          })
          .select()
          .single();

        if (error) throw error;

        task = formatTask(data);

        message = `Your task has been added: ${task.title}.`;

        break;
      }

      // ----------------------------------
      // SHOW EXPENSES
      // ----------------------------------

      case "show_expenses": {
        const { data, error } = await req.supabase
          .from("expenses")
          .select("id")
          .order("created_at", { ascending: false });

        if (error) throw error;

        message = data.length
          ? `You have ${data.length} saved expenses.`
          : "You have no expenses saved yet.";

        break;
      }

      // ----------------------------------
      // SHOW TASKS
      // ----------------------------------

      case "show_tasks": {
        const { data, error } = await req.supabase
          .from("tasks")
          .select("completed");

        if (error) throw error;

        const pendingTasks = data.filter(
          item => !item.completed
        ).length;

        const completedTasks = data.filter(
          item => item.completed
        ).length;

        message =
          `You have ${pendingTasks} pending tasks and ${completedTasks} completed tasks.`;

        break;
      }

      // ----------------------------------
      // COMPLETE TASK BY VOICE
      // ----------------------------------

      case "complete_task": {
        const requestedTask = (
          aiResult.task || ""
        ).toLowerCase().trim();

        if (!requestedTask) {
          message =
            "Please tell me which task you want to complete.";
          break;
        }

        const { data: pendingTasks, error } = await req.supabase
          .from("tasks")
          .select("*")
          .eq("completed", false);

        if (error) throw error;

        const matchingTask = pendingTasks.find(item => {
          const savedTitle = item.title.toLowerCase();

          return (
            savedTitle.includes(requestedTask) ||
            requestedTask.includes(savedTitle)
          );
        });

        if (!matchingTask) {
          message =
            `I couldn't find an incomplete task matching ${requestedTask}.`;
          break;
        }

        const { data, error: updateError } = await req.supabase
          .from("tasks")
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq("id", matchingTask.id)
          .select()
          .single();

        if (updateError) throw updateError;

        task = formatTask(data);

        message =
          `Great! Your task ${task.title} has been marked as completed.`;

        break;
      }

      // ----------------------------------
      // SHOW ALL-TIME EXPENSE TOTAL
      // ----------------------------------

      case "show_total": {
        const { data, error } = await req.supabase
          .from("expenses")
          .select("amount");

        if (error) throw error;

        total = data.reduce(
          (sum, item) => sum + Number(item.amount || 0),
          0
        );

        message =
          `Your total recorded spending is ₹${total}.`;

        break;
      }

      // ----------------------------------
      // MONTHLY EXPENSE INSIGHTS
      // ----------------------------------

      case "expense_insights": {
        const now = new Date();

        const currentMonth = now.toISOString().slice(0, 7);

        const requestedCategory = (
          aiResult.category || ""
        ).toLowerCase().trim();

        const { data, error } = await req.supabase
          .from("expenses")
          .select("*");

        if (error) throw error;

        const filteredExpenses = data.filter(item => {
          const isCurrentMonth =
            item.date?.slice(0, 7) === currentMonth;

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

      // ----------------------------------
      // GENERAL COMMAND
      // ----------------------------------

      default: {
        message =
          aiResult.message ||
          "Sorry, I couldn't understand that command. Please try again.";
      }
    }

    // ----------------------------------
    // RETURN UPDATED USER DATA
    // ----------------------------------

    const { data: expenseRows, error: expenseError } =
      await req.supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

    if (expenseError) throw expenseError;

    const { data: taskRows, error: taskError } =
      await req.supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

    if (taskError) throw taskError;

    expenses = expenseRows.map(formatExpense);
    tasks = taskRows.map(formatTask);

    res.json({
      success: true,
      intent: aiResult.intent,
      message,
      expense,
      task,
      expenses,
      tasks,
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

// ----------------------------------
// START SERVER
// ----------------------------------

app.listen(PORT, () => {
  console.log(
    `MyVoice AI backend running at http://localhost:${PORT}`
  );

  console.log("AI Model: gemini-flash-lite-latest");
  console.log("Database: Supabase PostgreSQL");
  console.log("Authentication: Supabase Auth");
});
