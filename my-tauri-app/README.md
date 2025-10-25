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



## Commands:
startup in dev
```
npm run tauri dev
```


## Notable articles / references
- https://stackoverflow.com/questions/78432685/why-does-tauri-modify-the-parameter-names-of-invoked-functionsQ