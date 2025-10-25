import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function GreetComponent() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <div className="greet-section" style={{ marginBottom: "2rem", padding: "1rem", backgroundColor: "#e8f4fd", borderRadius: "8px", border: "1px solid #b3d9ff" }}>
      <h2>👋 Test Rust Connection</h2>
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "1rem" }}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name..."
          style={{ padding: "0.5rem", border: "1px solid #ccc", borderRadius: "4px", flex: 1 }}
        />
        <button
          onClick={greet}
          style={{ padding: "0.5rem 1rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
        >
          Greet
        </button>
      </div>
      <div style={{
        backgroundColor: "#fff",
        padding: "0.75rem",
        borderRadius: "4px",
        border: "1px solid #ddd",
        minHeight: "40px",
        fontFamily: "monospace"
      }}>
        {greetMsg || "Enter your name and click Greet to test Rust backend"}
      </div>
    </div>
  );
}