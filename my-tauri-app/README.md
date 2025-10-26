# Tauri + React + Typescript



# RUST specific

## 
clean and recompile code
```
cargo clean && cargo check
```

run in debug mode
```
Maximum logging options:
# Most verbose Rust logging
RUST_LOG=trace npm run tauri dev

# Include all Tauri internal logs
RUST_LOG=tauri=trace npm run tauri dev

# Everything + Tauri dev server verbose
RUST_LOG=trace npm run tauri dev -- --verbose

# Nuclear option - all possible logs
RUST_LOG=trace,tauri=trace,tonic=trace npm run tauri dev -- --verbose
```



This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## System dependencies

Install these before running `npm run tauri dev`:
- Node.js 18+ (includes `npm`)
- Rust toolchain with `cargo` (via [`rustup`](https://rustup.rs/))
- Protobuf compiler `protoc` for regenerating gRPC bindings (`sudo apt install protobuf-compiler`)
- Linux desktop packages required by Tauri (Ubuntu/Debian: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev fonts-noto-color-emoji`)



## Commands:
startup in dev
```
npm run tauri dev
```


## Notable articles / references
- https://stackoverflow.com/questions/78432685/why-does-tauri-modify-the-parameter-names-of-invoked-functionsQ
