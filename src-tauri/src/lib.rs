use serde_json::Value;

mod db;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn pg_test_connection() -> Result<bool, String> {
    match db::check_connection() {
        Ok(_) => Ok(true),
        Err(e) => Err(e),
    }
}

#[tauri::command]
fn pg_save_template(template: db::QcTemplate) -> Result<(), String> {
    db::save_template(template)
}

#[tauri::command]
fn pg_get_templates() -> Result<Vec<db::QcTemplate>, String> {
    db::get_templates()
}

#[tauri::command]
fn pg_save_report(report: db::QcReport) -> Result<(), String> {
    db::save_report(report)
}

#[tauri::command]
fn pg_get_reports() -> Result<Vec<db::QcReport>, String> {
    db::get_reports()
}

#[tauri::command]
fn pg_get_active_plm_activities() -> Result<Vec<db::ActivePlmActivity>, String> {
    db::get_active_plm_activities()
}

#[tauri::command]
fn pg_get_plm_activity_items(plm_id: String) -> Result<Vec<db::PlmActivityItem>, String> {
    db::get_plm_activity_items(&plm_id)
}



#[tauri::command]
fn save_packaging_project(project: db::PackagingProject) -> Result<(), String> {
    db::save_packaging_project(project)
}

#[tauri::command]
fn save_packaging_session(session: db::PackagingProjectSession) -> Result<(), String> {
    db::save_packaging_session(session)
}

#[tauri::command]
fn save_packaging_defect_image(image: db::PackagingDefectImage) -> Result<(), String> {
    db::save_packaging_defect_image(image)
}

#[tauri::command]
fn get_packaging_projects() -> Result<Value, String> {
    db::get_packaging_projects()
}

#[tauri::command]
fn delete_packaging_project(project_id: String) -> Result<(), String> {
    db::delete_packaging_project(&project_id)
}

#[tauri::command]
fn get_packaging_project_reports(project_id: String, session_id: Option<String>) -> Result<Value, String> {
    db::get_packaging_project_reports(&project_id, session_id.as_deref())
}

#[tauri::command]
fn save_packaging_project_reports(reports: Vec<db::PackagingProjectReport>) -> Result<(), String> {
    db::save_packaging_project_reports(reports)
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
            save_packaging_project_reports
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


