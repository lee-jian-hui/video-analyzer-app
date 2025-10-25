use serde_json::Value;
use std::process::{Command, Stdio};
use std::net::TcpStream;

pub mod video_processor {
    tonic::include_proto!("videoprocessor");
}

use video_processor::{
    video_processor_service_client::VideoProcessorServiceClient,
    VideoUploadRequest, QueryRequest, StatusRequest
};


// Constants
// TODO: move into env later
const GRPC_SERVER_URL: &str = "http://127.0.0.1:50051";

fn ensure_python_backend() {
    if TcpStream::connect("127.0.0.1:50051").is_err() {
        println!("🦀 Starting Python backend...");
        Command::new("python")
            .arg("python-backend/server.py")
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("Failed to start Python backend");
    }
}

// Master gRPC function that handles all service calls
async fn call_grpc_service<Req, Resp, F>(
    request: Req,
    service_fn: F,
) -> Result<Value, String>
where
    Req: Send + 'static,
    Resp: serde::Serialize,
    F: FnOnce(VideoProcessorServiceClient<tonic::transport::Channel>, Req) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<tonic::Response<Resp>, tonic::Status>> + Send>>,
{
    let client = VideoProcessorServiceClient::connect(GRPC_SERVER_URL)
        .await
        .map_err(|e| format!("Failed to connect to gRPC server at {}: {}", GRPC_SERVER_URL, e))?;

    let response = service_fn(client, request)
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    serde_json::to_value(response.into_inner())
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

//  commands: https://tauri.app/develop/calling-rust/
#[tauri::command(rename_all = "snake_case")]
fn greet(name: &str) -> String {
    println!("🦀 greet called with {}", name);
    return format!("Hello, {}! You've been greeted from Rust!", name);

}

#[tauri::command(rename_all = "snake_case")]
async fn upload_video(filename: String, video_data: Vec<u8>) -> Result<Value, String> {
    println!("🦀 Rust: upload_video called with {}", filename);
    println!("🦀 Rust: video_data size: {}", video_data.len());
    let request = VideoUploadRequest { filename, video_data };

    call_grpc_service(request, |mut client, req| {
        Box::pin(async move {
            client.upload_video(tonic::Request::new(req)).await
        })
    }).await
}

#[tauri::command(rename_all = "snake_case")]

async fn process_query(video_id: String, query: String, query_type: String) -> Result<Value, String> {
    let request = QueryRequest { video_id, query, query_type };

    call_grpc_service(request, |mut client, req| {
        Box::pin(async move {
            client.process_query(tonic::Request::new(req)).await
        })
    }).await
}

#[tauri::command(rename_all = "snake_case")]

async fn get_processing_status(video_id: String) -> Result<Value, String> {
    let request = StatusRequest { video_id };

    call_grpc_service(request, |mut client, req| {
        Box::pin(async move {
            client.get_processing_status(tonic::Request::new(req)).await
        })
    }).await
}

// #[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    ensure_python_backend();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, upload_video, process_query, get_processing_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
