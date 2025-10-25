use serde_json::Value;

pub mod video_processor {
    tonic::include_proto!("videoprocessor");
}

use video_processor::{
    video_processor_service_client::VideoProcessorServiceClient,
    VideoUploadRequest, QueryRequest, StatusRequest
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn py_api(method: String, payload: Option<Value>) -> Result<Value, String> {
    let mut client = MyApiServiceClient::connect("http://127.0.0.1:50051")
        .await
        .map_err(|e| e.to_string())?;

    // Convert JSON payload → protobuf request
    let query = payload
        .and_then(|v| v.get("query").and_then(|q| q.as_str()).map(|s| s.to_string()))
        .unwrap_or_default();

    let request = tonic::Request::new(DataRequest { query });

    let response = client
        .get_data(request)
        .await
        .map_err(|e| e.to_string())?;

    // Convert protobuf → JSON
    Ok(serde_json::json!({ "result": response.into_inner().result }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, py_api])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
