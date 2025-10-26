fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .compile(&["proto/video_analyzer.proto"], &["proto"])?;
    tauri_build::build();
    Ok(())
}
