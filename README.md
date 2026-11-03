# 🎙️ MyVoice AI — Your Voice, Your Assistant

**A voice-powered personal AI assistant that turns natural language into real actions.**

MyVoice AI helps users manage their daily expenses and tasks through simple voice or text commands. Powered by Google Gemini, it understands user intent, performs the requested action, stores information securely, and responds with voice feedback.

🌐 **Live Demo:** https://myvoice-ai-frontend.onrender.com/  
💻 **GitHub Repository:** https://github.com/abhishekraj-77/MyVoice-Ai

---

## ✨ Features

### 🎤 Voice-Based Interaction
- Convert speech into text using the browser's Web Speech API.
- Understand natural language commands.
- Receive spoken responses using Speech Synthesis.
- Type commands when voice input is unavailable.

### 💰 Smart Expense Tracking
- Add expenses using natural language.
- Automatically identify expense amount, category, description, and date.
- View recorded expense history.
- Calculate total expenses.
- Ask questions about spending and get AI-powered insights.

### 📝 Task Management
- Create tasks through voice or text.
- View saved tasks.
- Mark tasks as completed using natural language.
- Track completed and pending tasks.

### 🔐 Authentication and Data Privacy
- Sign up and log in using Supabase Authentication.
- Restore login sessions automatically.
- Keep each user's expenses and tasks separate.
- Use PostgreSQL Row Level Security (RLS) to protect user data.

### 📊 Dashboard
- View total expenses.
- Track the number of tasks created.
- Monitor completed tasks.
- Access expense history and task lists.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite |
| Styling | CSS |
| Backend | Node.js, Express.js |
| AI Engine | Google Gemini API |
| Speech Recognition | Web Speech API |
| Voice Response | SpeechSynthesis API |
| Authentication | Supabase Auth |
| Database | Supabase PostgreSQL |
| Database Security | Row Level Security (RLS) |
| Deployment | Render |
| Version Control | Git, GitHub |

---

## 🏗️ Application Architecture

```text
                 USER
                   |
          Voice Input / Text
                   |
                   v
          REACT FRONTEND
                   |
          Speech Recognition
                   |
                   v
          EXPRESS BACKEND
                   |
                   v
             GEMINI AI
                   |
          Intent Recognition
                   |
       +-----------+-----------+
       |           |           |
       v           v           v
   Add Expense  Add Task   Query Data
       |           |           |
       +-----------+-----------+
                   |
                   v
          SUPABASE DATABASE
          PostgreSQL + RLS
                   |
                   v
          Backend Response
                   |
                   v
          React Dashboard
                   |
                   v
          Spoken AI Response
```

---

## 🗣️ Example Voice Commands

**Expense Tracking**
- "I spent 250 rupees on lunch."
- "I spent 500 rupees on groceries."
- "Show my total expenses."
- "How much did I spend on food?"

**Task Management**
- "Add a task to complete my DSA assignment."
- "Add a task to prepare for my interview."
- "Show my tasks."
- "Mark my DSA assignment as completed."

---

## 🚀 Run the Project Locally

### 1. Clone the repository

```bash
git clone https://github.com/abhishekraj-77/MyVoice-Ai.git
cd MyVoice-Ai
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Start the backend:

```bash
npm start
```

The backend runs at `http://localhost:5000`.

### 3. Configure the frontend

Open another terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Start the frontend:

```bash
npm run dev
```

Open the local URL provided by Vite, usually `http://localhost:5173`.

### 4. Supabase Database Setup

Create a Supabase project and configure:

- An `expenses` table.
- A `tasks` table.
- A `user_id` column referencing `auth.users`.
- Row Level Security (RLS) on both tables.
- Policies restricting users to their own records.
- Appropriate table and sequence permissions for the `authenticated` role.

Configure email authentication in Supabase Auth.

**Important:** Never commit `.env` files, Gemini API keys, or Supabase secret/service-role keys to GitHub.

---

## 📁 Project Structure

```text
MyVoice-Ai/
│
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── Auth.jsx
│   │   ├── supabaseClient.js
│   │   └── index.css
│   ├── package.json
│   └── .env
│
└── README.md
```

`.env` files are local configuration files and should be excluded from version control.

---

## 🔌 Backend API

| Method | Endpoint | Purpose | Authentication |
|---|---|---|---|
| GET | `/` | Backend health check | No |
| GET | `/api/data` | Retrieve user-specific expenses and tasks | Yes |
| POST | `/api/command` | Process an AI command | Yes |

Protected endpoints require a valid Supabase access token in the Authorization header:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 🔒 Security

- Supabase Authentication verifies user identity.
- Backend middleware validates access tokens.
- Database requests use the authenticated user's token.
- RLS policies restrict access to records belonging to the logged-in user.
- API secrets are stored in environment variables.

---

## 🌐 Deployment

- **Frontend:** Render Static Site
- **Backend:** Render Web Service
- **Database and Authentication:** Supabase

**Live Application:** https://myvoice-ai-frontend.onrender.com/

---

## 🔮 Future Improvements

- Monthly and weekly expense analytics.
- Expense charts and visual reports.
- Reminders and notifications for pending tasks.
- Support for multiple languages.
- More advanced financial insights.
- Mobile-friendly voice assistant experience.

---

## 👨‍💻 Author

**Abhishek Raj**

B.Tech Computer Science and Engineering

GitHub: https://github.com/abhishekraj-77

---

*MyVoice AI — Your voice, your assistant.* 🎙️
