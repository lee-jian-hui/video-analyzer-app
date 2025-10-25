use serde_json::Value;

pub mod video_processor {
    tonic::include_proto!("videoprocessor");
}

use video_processor::{
    video_processor_service_client::VideoProcessorServiceClient,
    VideoUploadRequest, QueryRequest, StatusRequest
};

// Constants
const GRPC_SERVER_URL: &str = "http://127.0.0.1:50051";

// Master gRPC client function
async fn get_grpc_client() -> Result<VideoProcessorServiceClient<tonic::transport::Channel>, String> {
    VideoProcessorServiceClient::connect(GRPC_SERVER_URL)
        .await
        .map_err(|e| format!("Failed to connect to gRPC server at {}: {}", GRPC_SERVER_URL, e))
}

// Generic error handler
fn handle_grpc_error(error: tonic::Status) -> String {
    format!("gRPC call failed: {}", error)
}

//  commands: https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn upload_video(filename: String, video_data: Vec<u8>) -> Result<Value, String> {
    let mut client = get_grpc_client().await?;

    let request = tonic::Request::new(VideoUploadRequest {
        filename,
        video_data,
    });

    let response = client
        .upload_video(request)
        .await
        .map_err(handle_grpc_error)?;

    let resp = response.into_inner();
    Ok(serde_json::json!({
        "video_id": resp.video_id,
        "success": resp.success,
        "message": resp.message
    }))
}

#[tauri::command]
async fn process_query(video_id: String, query: String, query_type: String) -> Result<Value, String> {
    let mut client = get_grpc_client().await?;

    let request = tonic::Request::new(QueryRequest {
        video_id,
        query,
        query_type,
    });

    let response = client
        .process_query(request)
        .await
        .map_err(handle_grpc_error)?;

    let resp = response.into_inner();
    Ok(serde_json::json!({
        "result": resp.result,
        "success": resp.success,
        "error_message": resp.error_message
    }))
}

#[tauri::command]
async fn get_processing_status(video_id: String) -> Result<Value, String> {
    let mut client = get_grpc_client().await?;

    let request = tonic::Request::new(StatusRequest { video_id });

    let response = client
        .get_processing_status(request)
        .await
        .map_err(handle_grpc_error)?;

    let resp = response.into_inner();
    Ok(serde_json::json!({
        "status": resp.status,
        "progress_percentage": resp.progress_percentage,
        "message": resp.message
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, upload_video, process_query, get_processing_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
