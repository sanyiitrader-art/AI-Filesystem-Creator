use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub role: MessageRole,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub messages: Vec<Message>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub id: String,
    pub title: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct Settings {
    gemini_api_key: Option<String>,
}

fn conversations_dir(app: &AppHandle) -> io::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?
        .join("conversations");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn settings_path(app: &AppHandle) -> io::Result<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    fs::create_dir_all(&dir)?;
    Ok(dir.join("settings.json"))
}

fn read_settings(app: &AppHandle) -> io::Result<Settings> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let raw = fs::read_to_string(&path)?;
    serde_json::from_str(&raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn write_settings(app: &AppHandle, settings: &Settings) -> io::Result<()> {
    let path = settings_path(app)?;
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(path, raw)
}

pub fn list_conversations(app: &AppHandle) -> io::Result<Vec<ConversationSummary>> {
    let dir = conversations_dir(app)?;
    let mut summaries = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        if entry.path().extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(entry.path())?;
        if let Ok(convo) = serde_json::from_str::<Conversation>(&raw) {
            summaries.push(ConversationSummary {
                id: convo.id,
                title: convo.title,
                updated_at: convo.updated_at,
            });
        }
    }

    summaries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(summaries)
}

pub fn search_conversations(
    app: &AppHandle,
    query: &str,
) -> io::Result<Vec<ConversationSummary>> {
    let query_lower = query.to_lowercase();
    let all = list_conversations(app)?;

    if query_lower.trim().is_empty() {
        return Ok(all);
    }

    Ok(all
        .into_iter()
        .filter(|c| c.title.to_lowercase().contains(&query_lower))
        .collect())
}

pub fn get_conversation(app: &AppHandle, id: &str) -> io::Result<Conversation> {
    let path = conversations_dir(app)?.join(format!("{id}.json"));
    let raw = fs::read_to_string(path)?;
    serde_json::from_str(&raw).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

pub fn create_conversation(app: &AppHandle) -> io::Result<Conversation> {
    let convo = Conversation {
        id: Uuid::new_v4().to_string(),
        title: "New chat".to_string(),
        messages: Vec::new(),
        updated_at: now_iso8601(),
    };
    save_conversation(app, &convo)?;
    Ok(convo)
}

pub fn save_conversation(app: &AppHandle, conversation: &Conversation) -> io::Result<()> {
    let path = conversations_dir(app)?.join(format!("{}.json", conversation.id));
    let raw = serde_json::to_string_pretty(conversation)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    fs::write(path, raw)
}

pub fn delete_conversation(app: &AppHandle, id: &str) -> io::Result<()> {
    let path = conversations_dir(app)?.join(format!("{id}.json"));
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

pub fn set_api_key(app: &AppHandle, key: &str) -> io::Result<()> {
    let mut settings = read_settings(app)?;
    settings.gemini_api_key = Some(key.to_string());
    write_settings(app, &settings)
}

pub fn has_api_key(app: &AppHandle) -> io::Result<bool> {
    Ok(read_settings(app)?.gemini_api_key.is_some())
}

pub fn get_api_key(app: &AppHandle) -> io::Result<Option<String>> {
    Ok(read_settings(app)?.gemini_api_key)
}

fn now_iso8601() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}", now.as_secs())
}