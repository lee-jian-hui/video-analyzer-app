import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [apiResponse, setApiResponse] = useState("");
  const [loading, setLoading] = useState(false);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  async function callPythonApi(query: string) {
    setLoading(true);
    try {
      const response = await invoke("py_api", {
        method: "api",
        payload: { query }
      });
      setApiResponse(JSON.stringify(response, null, 2));
    } catch (error) {
      setApiResponse(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>

      <hr style={{ margin: "2rem 0" }} />

      <div className="api-section">
        <h2>Python gRPC API Test</h2>
        <div className="button-group" style={{ display: "flex", gap: "10px", marginBottom: "1rem", flexWrap: "wrap" }}>
          <button onClick={() => callPythonApi("hello")} disabled={loading}>
            Say Hello
          </button>
          <button onClick={() => callPythonApi("time")} disabled={loading}>
            Get Time
          </button>
          <button onClick={() => callPythonApi("users")} disabled={loading}>
            Get Users
          </button>
          <button onClick={() => callPythonApi("custom message")} disabled={loading}>
            Custom Message
          </button>
        </div>

        {loading && <p>Loading...</p>}

        <div className="response-container" style={{
          backgroundColor: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
          minHeight: "100px",
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
          {apiResponse || "Click a button to test the Python gRPC API"}
        </div>
      </div>
    </main>
  );
}

export default App;
