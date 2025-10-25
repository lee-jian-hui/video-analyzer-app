use serde_json::Value;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn py_api(method: String, payload: Option<Value>) -> Result<Value, String> {
    let client = reqwest::Client::new();

    // Default Python backend URL - you can modify this as needed
    let base_url = "http://127.0.0.1:8000";
    let url = format!("{}/{}", base_url, method);

    let response = match payload {
        Some(data) => {
            client
                .post(&url)
                .json(&data)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?
        }
        None => {
            client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?
        }
    };

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let result: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(result)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, py_api])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
