use serde_json::Value;

mod db;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn pg_test_connection() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(|| {
        match db::check_connection() {
            Ok(_) => Ok(true),
            Err(e) => Err(e),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_save_template(template: db::QcTemplate) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_template(template)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_get_templates() -> Result<Vec<db::QcTemplate>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        db::get_templates()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_save_report(report: db::QcReport) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_report(report)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_get_reports() -> Result<Vec<db::QcReport>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        db::get_reports()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_get_active_plm_activities() -> Result<Vec<db::ActivePlmActivity>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        db::get_active_plm_activities()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn pg_get_plm_activity_items(plm_id: String) -> Result<Vec<db::PlmActivityItem>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::get_plm_activity_items(&plm_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_project(project: db::PackagingProject) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_packaging_project(project)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_session(session: db::PackagingProjectSession) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_packaging_session(session)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_defect_image(image: db::PackagingDefectImage) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_packaging_defect_image(image)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_packaging_projects() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        db::get_packaging_projects()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_project_verification_doc(project_id: String, doc_base64: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_project_verification_doc(&project_id, &doc_base64)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn refresh_packaging_project_lines(project_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::refresh_packaging_project_lines(&project_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn delete_packaging_project(project_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::delete_packaging_project(&project_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_packaging_project_reports(project_id: String, session_id: Option<String>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::get_packaging_project_reports(&project_id, session_id.as_deref())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_project_reports(reports: Vec<db::PackagingProjectReport>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_packaging_project_reports(reports)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_chat_log(
    project_id: Option<String>,
    session_id: Option<String>,
    sender: String,
    message: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_chat_log(project_id, session_id, sender, message)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            pg_test_connection,
            pg_save_template,
            pg_get_templates,
            pg_save_report,
            pg_get_reports,
            pg_get_active_plm_activities,
            pg_get_plm_activity_items,

            save_packaging_project,
            save_packaging_session,
            save_packaging_defect_image,
            get_packaging_projects,
            delete_packaging_project,
            get_packaging_project_reports,
            save_packaging_project_reports,
            save_project_verification_doc,
            refresh_packaging_project_lines,
            save_chat_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


