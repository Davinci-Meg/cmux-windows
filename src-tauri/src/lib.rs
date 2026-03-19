mod commands;
mod pty;
mod pty_manager;
pub mod settings;

use pty_manager::PtyManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            commands::create_pty,
            commands::start_pty,
            commands::write_pty,
            commands::resize_pty,
            commands::close_pty,
            commands::get_settings,
            commands::update_settings,
            commands::run_notification_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
