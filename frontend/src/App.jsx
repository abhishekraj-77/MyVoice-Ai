
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import Auth from "./Auth";
import { supabase } from "./supabaseClient";

const API_URL = "https://myvoice-ai-backend-mxnh.onrender.com";

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Your AI assistant is ready.");

  const [expenses, setExpenses] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [dataLoading, setDataLoading] = useState(true);

  // Restore login session and listen for login/logout changes
  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setDataLoading(true);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Session error:", error.message);
      }

      setSession(data.session);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Calculate dashboard statistics
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  // Speak AI response
  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 1;

    window.speechSynthesis.speak(speech);
  };

  // Load only the logged-in user's expenses and tasks
  const refreshDashboard = useCallback(async () => {
    if (!session?.access_token) return;

    try {
      const response = await fetch(`${API_URL}/api/data`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Session expired. Please log in again."
            : "Could not load dashboard data."
        );
      }

      const result = await response.json();

      setExpenses(Array.isArray(result.expenses) ? result.expenses : []);
      setTasks(Array.isArray(result.tasks) ? result.tasks : []);
    } catch (error) {
      console.error("Dashboard refresh failed:", error);
      setMessage(error.message || "Unable to load saved data.");
    } finally {
      setDataLoading(false);
    }
  }, [session?.access_token]);

  // Load saved data after login
  useEffect(() => {
    if (session?.access_token) {
      refreshDashboard();
    } else if (!authLoading) {
      setExpenses([]);
      setTasks([]);
      setDataLoading(false);
    }
  }, [session?.access_token, authLoading, refreshDashboard]);

  // Start microphone
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Speech recognition is not supported. Try Google Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setMessage("Listening to your voice...");
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      setMessage("Voice successfully converted to text.");
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setMessage("Could not recognize your voice. Please try again.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error("Microphone error:", error);
      setListening(false);
      setMessage("Unable to start microphone. Please try again.");
    }
  };

  // Send command to Gemini backend using the user's access token
  const handleSubmit = async () => {
    if (!transcript.trim()) {
      setMessage("Please speak or enter a command first.");
      return;
    }

    if (loading) return;

    if (!session?.access_token) {
      setMessage("Please log in again.");
      return;
    }

    setLoading(true);
    setMessage("MyVoice AI is thinking...");

    try {
      const response = await fetch(`${API_URL}/api/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          command: transcript.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Request failed.");
      }

      setMessage(result.message);

      if (Array.isArray(result.expenses)) {
        setExpenses(result.expenses);
      }

      if (Array.isArray(result.tasks)) {
        setTasks(result.tasks);
      }

      speak(result.message);
      setTranscript("");
    } catch (error) {
      console.error("Command error:", error);
      setMessage(error.message || "Unable to connect to the backend.");
      speak("Sorry, something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Change tabs and refresh saved data
  const changeTab = (tab) => {
    setActiveTab(tab);
    refreshDashboard();
  };

  // Log out
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage("Unable to log out. Please try again.");
      console.error("Logout error:", error.message);
    } else {
      setTranscript("");
      setExpenses([]);
      setTasks([]);
      setActiveTab("Dashboard");

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  // Authentication loading screen
  if (authLoading) {
    return (
      <div className="app" style={{ display: "grid", placeItems: "center" }}>
        <h2>Loading MyVoice AI...</h2>
      </div>
    );
  }

  // Show login/signup when the user is not logged in
  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">🎙️ MyVoice AI</div>

        <nav>
          {["Dashboard", "Expenses", "Tasks", "Settings"].map((tab) => (
            <div
              key={tab}
              className={`nav-item ${activeTab === tab ? "active" : ""}`}
              onClick={() => changeTab(tab)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  changeTab(tab);
                }
              }}
            >
              {tab === "Dashboard"
                ? "⌂"
                : tab === "Expenses"
                ? "↗"
                : tab === "Tasks"
                ? "✓"
                : "⚙"}{" "}
              {tab}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span>Powered by Voice AI</span>
          <p>Version 1.0</p>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h2>{activeTab}</h2>
            <p>Your personal AI assistant</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span>
              {session.user?.user_metadata?.full_name ||
                session.user?.email}
            </span>

            <button
              className="profile"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
            >
              ↪
            </button>
          </div>
        </header>

        {activeTab === "Dashboard" && (
          <>
            <section className="welcome">
              <div>
                <span className="tag">YOUR AI ASSISTANT</span>
                <h1>Good day! 👋</h1>
                <p>
                  Manage your expenses and tasks using just your voice.
                  I'm here to make your day easier.
                </p>
              </div>

              <div className="welcome-icon">🤖</div>
            </section>

            <section className="stats">
              <div className="stat-card">
                <span>Total Expenses</span>
                <h2>
                  {dataLoading
                    ? "Loading..."
                    : `₹${totalExpenses.toLocaleString("en-IN")}`}
                </h2>
                <small>All recorded expenses</small>
              </div>

              <div className="stat-card">
                <span>Tasks Created</span>
                <h2>{dataLoading ? "..." : tasks.length}</h2>
                <small>All tasks</small>
              </div>

              <div className="stat-card">
                <span>Completed Tasks</span>
                <h2>{dataLoading ? "..." : completedTasks}</h2>
                <small>Successfully completed</small>
              </div>
            </section>
          </>
        )}

        {activeTab === "Expenses" && (
          <section className="examples">
            <h2>Expense History</h2>

            {dataLoading ? (
              <p>Loading expenses...</p>
            ) : expenses.length === 0 ? (
              <p>No expenses recorded yet.</p>
            ) : (
              expenses.map((expense) => (
                <div className="example-list" key={expense.id}>
                  <div>
                    💰 {expense.description} — ₹
                    {Number(expense.amount).toLocaleString("en-IN")}
                    <small> ({expense.category})</small>
                    <small>{" "} • {expense.date?.split("T")[0]}</small>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "Tasks" && (
          <section className="examples">
            <h2>My Tasks</h2>

            {dataLoading ? (
              <p>Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p>No tasks created yet.</p>
            ) : (
              tasks.map((task) => (
                <div className="example-list" key={task.id}>
                  <div>
                    {task.completed ? "✅" : "📝"} {task.title}
                    {task.dueDate && ` — ${task.dueDate}`}
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {activeTab === "Settings" && (
          <section className="examples">
            <h2>Settings</h2>
            <p>MyVoice AI — Version 1.0</p>
            <p>Speech recognition language: English (India)</p>
            <p>AI engine: Google Gemini Flash Lite</p>
            <p>Account: {session.user?.email}</p>
            <button onClick={handleLogout}>Log out</button>
          </section>
        )}

        <section className="assistant">
          <div className="section-heading">
            <div>
              <h2>Talk to MyVoice AI</h2>
              <p>Speak naturally. I'll understand your request.</p>
            </div>

            <span className="online">● Online</span>
          </div>

          <div className="voice-area">
            <button
              className={`mic-button ${listening ? "listening" : ""}`}
              onClick={startListening}
              disabled={listening || loading}
              aria-label="Start voice recognition"
            >
              {listening ? "🎧" : "🎙️"}
            </button>

            <h3>{listening ? "Listening..." : "Tap to speak"}</h3>
            <p>{message}</p>

            <div className="transcript">
              <label>Your command</label>

              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder='Try: "I spent 250 rupees on lunch"'
              />

              <button onClick={handleSubmit} disabled={loading}>
                {loading ? "Processing..." : "Send command →"}
              </button>
            </div>
          </div>
        </section>

        <section className="examples">
          <h3>Try saying something like</h3>

          <div className="example-list">
            <div>💰 "I spent 250 rupees on lunch."</div>
            <div>📝 "Add a task to complete my assignment."</div>
            <div>📊 "Show my total expenses."</div>
          </div>
        </section>

        <footer>
          MyVoice AI © 2026 | Your voice, your assistant.
        </footer>
      </main>
    </div>
  );
}

export default App;
