use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// Top-level application settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub shell: ShellSettings,
    pub appearance: AppearanceSettings,
    pub text_box: TextBoxSettings,
    pub sidebar: SidebarSettings,
    pub window: WindowSettings,
    pub notifications: NotificationSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ShellSettings {
    /// "default" to use the system default, or an absolute path to a shell executable.
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppearanceSettings {
    pub theme: String,
    pub font_family: String,
    pub font_size: u32,
    pub color_scheme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TextBoxSettings {
    pub enabled: bool,
    pub enter_to_send: bool,
    pub escape_behavior: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SidebarSettings {
    pub visible: bool,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct WindowSettings {
    pub width: u32,
    pub height: u32,
    pub start_maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct NotificationSettings {
    pub agent_done: bool,
    pub custom_command: String,
}

// --- Defaults ---

impl Default for Settings {
    fn default() -> Self {
        Self {
            shell: ShellSettings::default(),
            appearance: AppearanceSettings::default(),
            text_box: TextBoxSettings::default(),
            sidebar: SidebarSettings::default(),
            window: WindowSettings::default(),
            notifications: NotificationSettings::default(),
        }
    }
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            agent_done: true,
            custom_command: String::new(),
        }
    }
}

impl Default for ShellSettings {
    fn default() -> Self {
        Self {
            path: "default".to_string(),
        }
    }
}

impl Default for AppearanceSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_family: "'Cascadia Code', 'Cascadia Mono', Consolas, monospace".to_string(),
            font_size: 14,
            color_scheme: "default".to_string(),
        }
    }
}

impl Default for TextBoxSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            enter_to_send: true,
            escape_behavior: "clear".to_string(),
        }
    }
}

impl Default for SidebarSettings {
    fn default() -> Self {
        Self {
            visible: true,
            width: 250,
        }
    }
}

impl Default for WindowSettings {
    fn default() -> Self {
        Self {
            width: 1200,
            height: 800,
            start_maximized: false,
        }
    }
}

// --- Load / Save ---

impl Settings {
    /// Return the path to the config file: %APPDATA%\cmux-windows\config.json
    fn config_path() -> Result<PathBuf, String> {
        let app_data = dirs::config_dir()
            .ok_or_else(|| "Could not determine APPDATA directory".to_string())?;
        Ok(app_data.join("cmux-windows").join("config.json"))
    }

    /// Load settings from disk, or return defaults if the file doesn't exist.
    pub fn load() -> Result<Self, String> {
        let path = Self::config_path()?;

        if !path.exists() {
            return Ok(Self::default());
        }

        let content =
            fs::read_to_string(&path).map_err(|e| format!("Failed to read config: {e}"))?;

        serde_json::from_str(&content).map_err(|e| format!("Failed to parse config: {e}"))
    }

    /// Save settings to disk, creating the directory if needed.
    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path()?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {e}"))?;
        }

        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize settings: {e}"))?;

        fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))
    }
}
