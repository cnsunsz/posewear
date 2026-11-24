#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 前端经 window.__TAURI__.http.fetch 走原生 HTTP，调用各家图像 API 不受浏览器 CORS 限制
        .plugin(tauri_plugin_http::init())
        .run(tauri::generate_context!())
        .expect("error while running PoseWear");
}
