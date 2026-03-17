use tauri::{AppHandle, State};

use crate::pty_manager::PtyManager;
use crate::settings::Settings;

const DEFAULT_SHELL: &str = "cmd.exe";
const DEFAULT_COLS: u16 = 120;
const DEFAULT_ROWS: u16 = 30;

/// Create a new PTY session. Returns the tab ID.
/// The read loop is NOT started - call start_pty after registering the event listener.
#[tauri::command]
pub fn create_pty(
    manager: State<'_, PtyManager>,
    shell: Option<String>,
    cols: Option<u32>,
    rows: Option<u32>,
) -> Result<String, String> {
    let shell = shell.as_deref().unwrap_or(DEFAULT_SHELL);
    let cols = cols.map(|c| c as u16).unwrap_or(DEFAULT_COLS);
    let rows = rows.map(|r| r as u16).unwrap_or(DEFAULT_ROWS);
    manager.create_session(shell, cols, rows)
}

/// Start the read loop for a PTY session.
/// Call this AFTER the frontend has registered its pty-output event listener.
#[tauri::command]
pub fn start_pty(
    app_handle: AppHandle,
    manager: State<'_, PtyManager>,
    tab_id: String,
) -> Result<(), String> {
    manager.start_session(app_handle, &tab_id)
}

/// Write data to a PTY session.
#[tauri::command]
pub fn write_pty(
    manager: State<'_, PtyManager>,
    tab_id: String,
    data: String,
) -> Result<(), String> {
    manager.write_to_session(&tab_id, data.as_bytes())
}

/// Resize a PTY session.
#[tauri::command]
pub fn resize_pty(
    manager: State<'_, PtyManager>,
    tab_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    manager.resize_session(&tab_id, cols as u16, rows as u16)
}

/// Close a PTY session.
#[tauri::command]
pub fn close_pty(
    manager: State<'_, PtyManager>,
    tab_id: String,
) -> Result<(), String> {
    manager.close_session(&tab_id)
}

/// Get the current application settings.
#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    Settings::load()
}

/// Update the application settings.
#[tauri::command]
pub fn update_settings(settings: Settings) -> Result<(), String> {
    settings.save()
}
