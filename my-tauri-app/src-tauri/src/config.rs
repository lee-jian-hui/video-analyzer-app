/// Configuration module for Tauri backend settings
///
/// The Tauri/Rust layer acts as a CLIENT that connects to the Python backend gRPC server.
///
/// Architecture:
/// ```
/// Frontend (React) → Tauri (Rust Client) → Python gRPC Server
/// ```
///
/// Best practices:
/// - Environment variables for deployment flexibility
/// - Compile-time defaults for development ease
/// - Centralized configuration management

use std::env;

/// gRPC client configuration for connecting to Python backend
pub struct GrpcConfig;

impl GrpcConfig {
    /// Get the Python backend gRPC server URL
    ///
    /// This is the URL where the Python video analyzer backend is running.
    /// The Rust/Tauri layer connects to this server as a gRPC CLIENT.
    ///
    /// Priority:
    /// 1. GRPC_SERVER_URL environment variable (runtime)
    /// 2. Default localhost:50051 (development)
    ///
    /// # Examples
    ///
    /// ```bash
    /// # Development (Python server on same machine)
    /// cargo run
    ///
    /// # Production (Python server on different host)
    /// GRPC_SERVER_URL=http://backend-server:50051 cargo run
    /// ```
    pub fn server_url() -> String {
        env::var("GRPC_SERVER_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:50051".to_string())
    }

    /// Get the default chunk size for video uploads (in bytes)
    pub fn video_chunk_size() -> usize {
        env::var("VIDEO_CHUNK_SIZE")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(512 * 1024) // 512 KB default
    }
}

/// Application configuration
pub struct AppConfig;

impl AppConfig {
    /// Get log level from environment variable
    ///
    /// Reads LOG_LEVEL environment variable and returns appropriate log::LevelFilter
    ///
    /// Priority:
    /// 1. LOG_LEVEL environment variable
    /// 2. Default based on build mode (debug = debug, release = info)
    ///
    /// Valid values: trace, debug, info, warn, error, off
    pub fn log_level() -> log::LevelFilter {
        env::var("LOG_LEVEL")
            .ok()
            .and_then(|level| match level.to_lowercase().as_str() {
                "trace" => Some(log::LevelFilter::Trace),
                "debug" => Some(log::LevelFilter::Debug),
                "info" => Some(log::LevelFilter::Info),
                "warn" => Some(log::LevelFilter::Warn),
                "error" => Some(log::LevelFilter::Error),
                "off" => Some(log::LevelFilter::Off),
                _ => None,
            })
            .unwrap_or_else(|| {
                // Default: debug in dev, info in release
                if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                }
            })
    }

    /// Check if running in development mode
    pub fn is_dev() -> bool {
        env::var("DEV")
            .map(|v| v == "1" || v.to_lowercase() == "true")
            .unwrap_or(cfg!(debug_assertions))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_grpc_url() {
        // Should use default when env var not set
        assert_eq!(GrpcConfig::server_url(), "http://127.0.0.1:50051");
    }

    #[test]
    fn test_default_chunk_size() {
        assert_eq!(GrpcConfig::video_chunk_size(), 512 * 1024);
    }
}
