use serde_json::Value;
use tokio_stream::iter;
use tonic::{transport::Channel, Request};

pub mod video_analyzer {
    tonic::include_proto!("video_analyzer");
}

use video_analyzer::{
    video_analyzer_service_client::VideoAnalyzerServiceClient, ChatRequest, ChatResponse,
    HistoryRequest, RegisterVideoRequest, VideoChunk,
};

// Constants
// TODO: move into env later
const GRPC_SERVER_URL: &str = "http://127.0.0.1:50051";
const VIDEO_CHUNK_SIZE: usize = 512 * 1024;

async fn connect_client() -> Result<VideoAnalyzerServiceClient<Channel>, String> {
    VideoAnalyzerServiceClient::connect(GRPC_SERVER_URL)
        .await
        .map_err(|e| format!("Failed to connect to gRPC server at {}: {}", GRPC_SERVER_URL, e))
}

fn build_video_chunks(filename: &str, video_data: Vec<u8>) -> Vec<VideoChunk> {
    video_data
        .chunks(VIDEO_CHUNK_SIZE)
        .enumerate()
        .map(|(idx, chunk)| VideoChunk {
            data: chunk.to_vec(),
            filename: filename.to_string(),
            chunk_index: idx as i32,
        })
        .collect()
}

async fn collect_chat_stream(
    mut stream: tonic::Streaming<ChatResponse>,
) -> Result<Value, String> {
    let mut responses = Vec::new();
    while let Some(message) = stream
        .message()
        .await
        .map_err(|e| format!("Chat stream error: {}", e))?
    {
        responses.push(message);
    }

    serde_json::to_value(responses).map_err(|e| format!("Failed to serialize chat stream: {}", e))
}

//  commands: https://tauri.app/develop/calling-rust/
#[tauri::command(rename_all = "snake_case")]
fn greet(name: &str) -> String {
    println!("🦀 greet called with {}", name);
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command(rename_all = "snake_case")]
async fn upload_video(filename: String, video_data: Vec<u8>) -> Result<Value, String> {
    println!("🦀 Rust: upload_video called with {}", filename);
    println!("🦀 Rust: video_data size: {}", video_data.len());

    let chunks = build_video_chunks(&filename, video_data);
    let request_stream = iter(chunks);

    let mut client = connect_client().await?;
    let response = client
        .upload_video(Request::new(request_stream))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    serde_json::to_value(response.into_inner())
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn register_local_video(
    file_path: String,
    display_name: String,
    reference_only: bool,
) -> Result<Value, String> {
    println!("🦀 Rust: register_local_video called with {}", file_path);

    let request = RegisterVideoRequest {
        file_path,
        display_name,
        reference_only,
    };

    let mut client = connect_client().await?;
    let response = client
        .register_local_video(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    serde_json::to_value(response.into_inner())
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn process_query(
    video_id: String,
    query: String,
    _query_type: String,
) -> Result<Value, String> {
    let request = ChatRequest {
        file_id: video_id,
        message: query,
    };

    let mut client = connect_client().await?;
    let stream = client
        .send_chat_message(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?
        .into_inner();

    collect_chat_stream(stream).await
}

#[tauri::command(rename_all = "snake_case")]
async fn get_processing_status(limit: i32) -> Result<Value, String> {
    let request = HistoryRequest { limit };

    let mut client = connect_client().await?;
    let response = client
        .get_chat_history(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    serde_json::to_value(response.into_inner())
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

// #[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            upload_video,
            register_local_video,
            process_query,
            get_processing_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
