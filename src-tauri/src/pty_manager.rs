use std::collections::HashMap;
use std::io::Read;
use std::sync::{Arc, Mutex};

use tauri::AppHandle;

use crate::pty::PtyProcess;

/// Manages multiple PTY sessions indexed by tab ID.
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtyProcess>>>,
    pending_readers: Arc<Mutex<HashMap<String, Box<dyn Read + Send>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            pending_readers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new PTY session and return its tab ID.
    pub fn create_session(
        &self,
        shell: &str,
        cols: u16,
        rows: u16,
    ) -> Result<String, String> {
        let tab_id = uuid::Uuid::new_v4().to_string();

        let result = PtyProcess::spawn(shell, cols, rows)?;

        let mut pending = self.pending_readers.lock().map_err(|e| e.to_string())?;
        pending.insert(tab_id.clone(), result.reader);

        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(tab_id.clone(), result.pty);

        Ok(tab_id)
    }

    /// Start the read loop for a PTY session.
    pub fn start_session(
        &self,
        app_handle: AppHandle,
        tab_id: &str,
    ) -> Result<(), String> {
        let reader = {
            let mut pending = self.pending_readers.lock().map_err(|e| e.to_string())?;
            pending
                .remove(tab_id)
                .ok_or_else(|| format!("No pending reader for session: {tab_id}"))?
        };

        PtyProcess::start_read_loop(reader, app_handle, tab_id.to_string());
        Ok(())
    }

    /// Write data to a specific PTY session.
    pub fn write_to_session(&self, tab_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let pty = sessions
            .get_mut(tab_id)
            .ok_or_else(|| format!("Session not found: {tab_id}"))?;
        pty.write(data)
    }

    /// Resize a specific PTY session.
    pub fn resize_session(&self, tab_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let pty = sessions
            .get(tab_id)
            .ok_or_else(|| format!("Session not found: {tab_id}"))?;
        pty.resize(cols, rows)
    }

    /// Close and remove a specific PTY session.
    pub fn close_session(&self, tab_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions
            .remove(tab_id)
            .ok_or_else(|| format!("Session not found: {tab_id}"))?;
        let mut pending = self.pending_readers.lock().map_err(|e| e.to_string())?;
        pending.remove(tab_id);
        Ok(())
    }
}
