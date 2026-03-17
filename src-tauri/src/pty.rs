use std::io::{Read, Write};

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter};

/// A portable-pty backed terminal process.
pub struct PtyProcess {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

/// Result of spawning a PTY: the process and a reader for its output.
pub struct SpawnResult {
    pub pty: PtyProcess,
    pub reader: Box<dyn Read + Send>,
}

impl PtyProcess {
    /// Spawn a new PTY-backed shell process.
    pub fn spawn(shell: &str, cols: u16, rows: u16) -> Result<SpawnResult, String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        let cmd = CommandBuilder::new(shell);
        pair.slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {e}"))?;

        // Drop slave to avoid blocking reads
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {e}"))?;

        Ok(SpawnResult {
            pty: PtyProcess {
                master: pair.master,
                writer,
            },
            reader,
        })
    }

    /// Start a background OS thread that reads PTY output and emits Tauri events.
    pub fn start_read_loop(
        mut reader: Box<dyn Read + Send>,
        app_handle: AppHandle,
        tab_id: String,
    ) {
        std::thread::spawn(move || {
            let event_name = format!("pty-output-{tab_id}");
            log::debug!("[PTY] Read loop started for tab: {tab_id}");
            let mut buf = [0u8; 4096];

            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        log::debug!("[PTY] EOF for tab {tab_id}");
                        let _ = app_handle.emit(&format!("pty-exit-{tab_id}"), ());
                        break;
                    }
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = app_handle.emit(&event_name, &text);
                    }
                    Err(e) => {
                        log::debug!("[PTY] Read error for tab {tab_id}: {e}");
                        let _ = app_handle.emit(&format!("pty-exit-{tab_id}"), ());
                        break;
                    }
                }
            }
        });
    }

    /// Write data to the PTY input.
    pub fn write(&mut self, data: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(data)
            .map_err(|e| format!("PTY write failed: {e}"))
    }

    /// Resize the PTY.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("PTY resize failed: {e}"))
    }
}
