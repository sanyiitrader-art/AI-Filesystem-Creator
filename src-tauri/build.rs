// Standard Tauri 2 build script. Generates the platform-specific
// bindings/resources Tauri needs at compile time (icons, manifest
// embedding, etc.) based on tauri.conf.json. No custom logic needed
// for this project -- kept as Tauri's default.

fn main() {
    tauri_build::build()
}