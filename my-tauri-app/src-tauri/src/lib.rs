use serde_json::Value;
use tokio_stream::iter;
use tokio::io::AsyncReadExt;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{transport::Channel, Request};
use log::{debug, warn};

mod config;
use config::{AppConfig, GrpcConfig};

pub mod video_analyzer {
    tonic::include_proto!("video_analyzer");
}

use video_analyzer::{
    video_analyzer_service_client::VideoAnalyzerServiceClient,
    ChatRequest, ChatResponse, ClearHistoryRequest, Empty, GetHistoryRequest,
    RegisterVideoRequest, VideoChunk, ResumeRequest,
};

async fn connect_client() -> Result<VideoAnalyzerServiceClient<Channel>, String> {
    let server_url = GrpcConfig::server_url();
    debug!("Connecting to gRPC server at {}", server_url);
    VideoAnalyzerServiceClient::connect(server_url.clone())
        .await
        .map_err(|e| format!("Failed to connect to gRPC server at {}: {}", server_url, e))
}

fn build_video_chunks(filename: &str, video_data: Vec<u8>) -> Vec<VideoChunk> {
    let chunk_size = GrpcConfig::video_chunk_size();
    video_data
        .chunks(chunk_size)
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
    use video_analyzer::chat_response::ResponseType;

    let mut responses: Vec<ChatResponse> = Vec::new();

    loop {
        match stream.message().await {
            Ok(Some(message)) => {
                responses.push(message);
            }
            Ok(None) => {
                // Normal end of stream
                break;
            }
            Err(e) => {
                // Append an ERROR chunk so the frontend still receives an array
                let err_msg = format!(
                    "Stream interrupted: {}. Some partial results may be missing.",
                    e
                );
                warn!("gRPC chat stream error: {}", err_msg);
                responses.push(ChatResponse {
                    r#type: ResponseType::Error as i32,
                    content: err_msg,
                    agent_name: "system".to_string(),
                    result_json: String::new(),
                });
                break;
            }
        }
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

    // Stream chunks via channel to avoid allocating all chunks upfront
    let chunk_size = GrpcConfig::video_chunk_size();
    let (tx, rx) = tokio::sync::mpsc::channel::<VideoChunk>(8);

    let fname = filename.clone();
    tokio::spawn(async move {
        let mut idx: i32 = 0;
        let mut offset: usize = 0;
        while offset < video_data.len() {
            let end = (offset + chunk_size).min(video_data.len());
            let slice = &video_data[offset..end];
            let chunk = VideoChunk {
                data: slice.to_vec(),
                filename: fname.clone(),
                chunk_index: idx,
            };
            offset = end;
            idx += 1;
            if tx.send(chunk).await.is_err() {
                break;
            }
        }
    });

    let request_stream = tokio_stream::wrappers::ReceiverStream::new(rx);

    let mut client = connect_client().await?;
    let response = client
        .upload_video(Request::new(request_stream))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    debug!(
        "upload_video response: success={}, file_id={}",
        inner.success,
        inner.file_id
    );
    serde_json::to_value(inner)
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn upload_video_from_path(file_path: String) -> Result<Value, String> {
    println!("🦀 Rust: upload_video_from_path called with {}", file_path);

    let chunk_size = GrpcConfig::video_chunk_size();
    let filename = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("video.mp4")
        .to_string();

    // Channel-backed stream to avoid buffering entire file
    let (tx, rx) = tokio::sync::mpsc::channel::<video_analyzer::VideoChunk>(8);

    let mut file = tokio::fs::File::open(&file_path)
        .await
        .map_err(|e| format!("Failed to open file {}: {}", file_path, e))?;

    // Spawn a task to read and send chunks
    let fname_clone = filename.clone();
    tokio::spawn(async move {
        let mut idx: i32 = 0;
        loop {
            let mut buf = vec![0u8; chunk_size];
            match file.read(&mut buf).await {
                Ok(0) => break, // EOF
                Ok(n) => {
                    buf.truncate(n);
                    let chunk = video_analyzer::VideoChunk {
                        data: buf,
                        filename: fname_clone.clone(),
                        chunk_index: idx,
                    };
                    idx += 1;
                    if tx.send(chunk).await.is_err() {
                        break;
                    }
                }
                Err(_) => {
                    // Best effort; stop streaming on read error
                    break;
                }
            }
        }
    });

    let request_stream = ReceiverStream::new(rx);

    let mut client = connect_client().await?;
    let response = client
        .upload_video(Request::new(request_stream))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    debug!(
        "upload_video_from_path response: success={}, file_id={}",
        inner.success,
        inner.file_id
    );
    serde_json::to_value(inner)
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
        message: query,
        file_id: video_id,
        context: String::new(),  // Empty context for now
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
async fn get_last_session() -> Result<Value, String> {
    println!("🦀 Rust: get_last_session called");

    let request = Empty {};

    let mut client = connect_client().await?;
    let response = client
        .get_last_session(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    debug!(
        "get_last_session response: has_session={}, video_id={:?}, video_name={:?}",
        inner.has_session, inner.video_id, inner.video_name
    );
    serde_json::to_value(inner)
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn get_chat_history(
    video_id: String,
    include_full_messages: bool,
) -> Result<Value, String> {
    println!(
        "🦀 Rust: get_chat_history called for video_id: {}, include_full: {}",
        video_id, include_full_messages
    );

    let request = GetHistoryRequest {
        video_id,
        include_full_messages,
    };

    let mut client = connect_client().await?;
    let response = client
        .get_chat_history(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    let summary_len = inner.conversation_summary.len();
    let msgs_len = inner.recent_messages.len();
    debug!(
        "get_chat_history response: video_id={:?}, summary_len={}, recent_messages_len={}",
        inner.video_id, summary_len, msgs_len
    );

    // Manually shape the JSON to avoid any serde/prost mismatch issues
    let recent_msgs: Vec<Value> = inner
        .recent_messages
        .into_iter()
        .map(|m| serde_json::json!({
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp,
        }))
        .collect();

    let shaped = serde_json::json!({
        "video_id": inner.video_id,
        "video_name": inner.video_name,
        "conversation_summary": inner.conversation_summary,
        "recent_messages": recent_msgs,
        "total_messages": inner.total_messages,
        "created_at": inner.created_at,
        "updated_at": inner.updated_at,
    });

    Ok(shaped)
}

#[tauri::command(rename_all = "snake_case")]
async fn resume_session(video_id: String) -> Result<Value, String> {
    println!("🦀 Rust: resume_session called for video_id: {}", video_id);

    let request = ResumeRequest { video_id };

    let mut client = connect_client().await?;
    let response = client
        .resume_session(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    debug!(
        "resume_session response: success={}, video_id={:?}, video_name={:?}",
        inner.success, inner.video_id, inner.video_name
    );
    serde_json::to_value(inner)
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn clear_chat_history(video_id: String) -> Result<Value, String> {
    println!("🦀 Rust: clear_chat_history called for video_id: {}", video_id);

    let request = ClearHistoryRequest { video_id };

    let mut client = connect_client().await?;
    let response = client
        .clear_chat_history(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    let inner = response.into_inner();
    debug!("clear_chat_history response: success={}, message={}", inner.success, inner.message);
    serde_json::to_value(inner)
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

#[tauri::command(rename_all = "snake_case")]
async fn check_backend_ready() -> Result<Value, String> {
    use tokio::time::{timeout, Duration};
    debug!("check_backend_ready: attempting ping via get_last_session");
    let mut client = match connect_client().await {
        Ok(c) => c,
        Err(e) => return Ok(serde_json::json!({ "ready": false, "message": e })),
    };

    let req = Request::new(Empty {});
    match timeout(Duration::from_secs(3), client.get_last_session(req)).await {
        Ok(Ok(_)) => Ok(serde_json::json!({ "ready": true })),
        Ok(Err(e)) => Ok(serde_json::json!({ "ready": false, "message": e.to_string() })),
        Err(_) => Ok(serde_json::json!({ "ready": false, "message": "timeout" })),
    }
}

// Legacy endpoint for backward compatibility (deprecated)
#[tauri::command(rename_all = "snake_case")]
async fn get_processing_status(_limit: i32) -> Result<Value, String> {
    println!("🦀 Rust: get_processing_status called (deprecated, use get_last_session)");

    // Redirect to get_last_session for now
    let request = Empty {};

    let mut client = connect_client().await?;
    let response = client
        .get_last_session(Request::new(request))
        .await
        .map_err(|e| format!("gRPC call failed: {}", e))?;

    serde_json::to_value(response.into_inner())
        .map_err(|e| format!("Failed to serialize response: {}", e))
}

// #[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Get log level from environment (reads LOG_LEVEL env var)
    let log_level = AppConfig::log_level();

    tauri::Builder::default()
        // Initialize logging plugin with env-based level
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log_level)
                .build()
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            upload_video,
            upload_video_from_path,
            register_local_video,
            process_query,
            get_last_session,
            get_chat_history,
            resume_session,
            clear_chat_history,
            get_processing_status, // Legacy, kept for backward compatibility
            check_backend_ready
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
