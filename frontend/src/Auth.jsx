
import { useState } from "react";
import { supabase } from "./supabaseClient";

function Auth() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created successfully!");
        } else {
          setMessage(
            "Account created! Please check your email to confirm your account."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f6fb",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          width: "100%",
          maxWidth: "420px",
          padding: "35px",
          borderRadius: "16px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "8px" }}>
          🎙️ MyVoice AI
        </h1>

        <p style={{ textAlign: "center", color: "#666" }}>
          {mode === "login"
            ? "Welcome back! Log in to continue."
            : "Create your personal AI assistant account."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password (minimum 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={buttonStyle}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        {message && (
          <p style={{ textAlign: "center", marginTop: "15px" }}>
            {message}
          </p>
        )}

        <p style={{ textAlign: "center", marginTop: "20px" }}>
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}

          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setMessage("");
            }}
            style={{
              border: "none",
              background: "none",
              color: "#4f46e5",
              cursor: "pointer",
              fontWeight: "bold",
              marginLeft: "5px",
            }}
          >
            {mode === "login" ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginTop: "15px",
  border: "1px solid #ddd",
  borderRadius: "8px",
  boxSizing: "border-box",
  fontSize: "15px",
};

const buttonStyle = {
  width: "100%",
  padding: "14px",
  marginTop: "20px",
  background: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "16px",
  cursor: "pointer",
};

export default Auth;
