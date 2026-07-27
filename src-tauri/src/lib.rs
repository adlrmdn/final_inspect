#![recursion_limit = "256"]
use serde_json::Value;

mod db;
mod listener;

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
async fn update_packaging_project_deductions(project_id: String, has_deduction: bool, deduction_amount: f64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::update_packaging_project_deductions(&project_id, has_deduction, deduction_amount)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_project(project: db::PackagingProject) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_packaging_project(project)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn trigger_partial_process_sync(project_id: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::trigger_partial_process_sync(&project_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn read_offline_projects_cache(app: tauri::AppHandle) -> Result<Value, String> {
    db::read_offline_projects_cache(app)
}

#[tauri::command]
async fn write_offline_projects_cache(app: tauri::AppHandle, data: Value) -> Result<(), String> {
    db::write_offline_projects_cache(app, data)
}

#[tauri::command]
async fn get_packaging_projects_summary() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(|| {
        db::get_packaging_projects_summary()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn get_packaging_project_details(project_id: String) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::get_packaging_project_details(&project_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_session_approval_info(
    project_id: String,
    session_id: String,
    approval_token: String,
    approval_email: String,
    inspector_name: Option<String>,
    inspector_email: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::save_session_approval_info(
            &project_id,
            &session_id,
            &approval_token,
            &approval_email,
            inspector_name.as_deref().unwrap_or(""),
            inspector_email.as_deref().unwrap_or(""),
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn reset_session_approval_info(
    project_id: String,
    session_id: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::reset_session_approval_info(&project_id, &session_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_packaging_session(session: db::PackagingProjectSession) -> Result<i32, String> {
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
async fn delete_packaging_defect_image(image_id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::delete_packaging_defect_image(&image_id)
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
async fn find_removed_project_by_prg(prg: String) -> Result<Option<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::find_removed_project_by_prg(&prg).map(|opt| {
            opt.map(|(project_id, status)| serde_json::json!({ "project_id": project_id, "status": status }))
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn restore_packaging_project(project_id: String, restore_status: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        db::restore_packaging_project(&project_id, &restore_status)
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

#[tauri::command]
async fn read_local_file_base64(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::fs::File;
        use std::io::Read;
        use base64::Engine;

        let mut file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| format!("Failed to read file: {}", e))?;
        
        let b64 = base64::engine::general_purpose::STANDARD.encode(buffer);
        
        let path_lower = path.to_lowercase();
        let mime = if path_lower.ends_with(".png") {
            "image/png"
        } else if path_lower.ends_with(".jpg") || path_lower.ends_with(".jpeg") {
            "image/jpeg"
        } else if path_lower.ends_with(".pdf") {
            "application/pdf"
        } else {
            "application/octet-stream"
        };
        
        Ok(format!("data:{};base64,{}", mime, b64))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn send_email_report(
    recipient: String,
    subject: String,
    html_body: String,
    attachment_body: Option<String>,
    attachment_filename: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        use lettre::transport::smtp::authentication::Credentials;
        use lettre::{Message, SmtpTransport, Transport};
        use lettre::message::{MultiPart, SinglePart, Attachment, header::ContentType};

        let sender_email = "rpa@megaperintis.co.id";
        let parsed_from = sender_email
            .parse::<lettre::address::Address>()
            .map_err(|e| format!("Invalid sender address: {}", e))?;

        let emails: Vec<&str> = recipient
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        if emails.is_empty() {
            return Err("Recipient email address is empty".to_string());
        }

        let creds = Credentials::new(sender_email.to_string(), "T]ra9C!Cwhc+".to_string());
        let mailer = SmtpTransport::starttls_relay("mail.megaperintis.co.id")
            .map_err(|e| e.to_string())?
            .port(587)
            .credentials(creds)
            .timeout(Some(std::time::Duration::from_secs(15)))
            .build();

        let display_name = Some("MPG QC Console System".to_string());

        // Parse and decode the base64 data URL attachment if provided
        let mut att_bytes = None;
        let mut att_mime = None;
        let mut att_ext = String::from(".pdf");

        if let Some(doc_base64) = &attachment_body {
            if doc_base64.starts_with("data:") {
                if let Some(comma_pos) = doc_base64.find(',') {
                    let header = &doc_base64[..comma_pos];
                    let payload = &doc_base64[comma_pos + 1..];

                    if let Some(semi_pos) = header.find(';') {
                        let mime = &header[5..semi_pos];
                        att_mime = Some(mime.to_string());
                        if mime == "application/pdf" {
                            att_ext = String::from(".pdf");
                        } else if mime.starts_with("image/") {
                            att_ext = format!(".{}", &mime[5..]);
                        }
                    }

                    use base64::Engine;
                    if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(payload.trim()) {
                        att_bytes = Some(bytes);
                    }
                }
            }
        }

        for email_addr in emails {
            let parsed_to = email_addr
                .parse::<lettre::address::Address>()
                .map_err(|e| format!("Invalid recipient email address '{}': {}", email_addr, e))?;

            // Plain text summary fallback to reduce spam score
            let plain_text_body = format!(
                "Dear Team,\n\nPlease find attached the official Quality Control Inspection Report.\n\nSubject: {}\n\nThis is an automated system notification from Final Inspection QC.",
                subject
            );

            // Construct standard alternative body (plain text + html body)
            let alternative_part = MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(plain_text_body),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html_body.clone()),
                );

            let message_builder = Message::builder()
                .from(lettre::message::Mailbox::new(display_name.clone(), parsed_from.clone()))
                .to(lettre::message::Mailbox::new(None, parsed_to))
                .subject(&subject);

            let email = if let (Some(bytes), Some(mime_str)) = (&att_bytes, &att_mime) {
                let att_content_type = ContentType::parse(mime_str)
                    .map_err(|e| format!("Invalid content type: {}", e))?;

                let final_filename = if let Some(base_name) = &attachment_filename {
                    if base_name.ends_with(".pdf") || base_name.ends_with(".png") || base_name.ends_with(".jpg") || base_name.ends_with(".jpeg") {
                        base_name.clone()
                    } else {
                        format!("{}{}", base_name, att_ext)
                    }
                } else {
                    format!("QC_Report{}", att_ext)
                };

                let attachment = Attachment::new(final_filename)
                    .body(bytes.clone(), att_content_type);

                message_builder.multipart(
                    MultiPart::mixed()
                        .multipart(alternative_part)
                        .singlepart(attachment)
                ).map_err(|e| e.to_string())?
            } else {
                message_builder.multipart(alternative_part).map_err(|e| e.to_string())?
            };

            mailer.send(&email).map_err(|e| e.to_string())?;
        }

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}


pub fn percent_decode(s: &str) -> String {
    let mut decoded = String::new();
    let mut chars = s.chars();
    while let Some(ch) = chars.next() {
        if ch == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(val) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                decoded.push(val as char);
            }
        } else if ch == '+' {
            decoded.push(' ');
        } else {
            decoded.push(ch);
        }
    }
    decoded
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                listener::start(handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            pg_test_connection,
            pg_save_template,
            pg_get_templates,
            pg_save_report,
            pg_get_reports,
            pg_get_active_plm_activities,
            pg_get_plm_activity_items,

            update_packaging_project_deductions,
            save_packaging_project,
            trigger_partial_process_sync,
            save_packaging_session,
            save_packaging_defect_image,
            delete_packaging_defect_image,
            get_packaging_projects,
            delete_packaging_project,
            find_removed_project_by_prg,
            restore_packaging_project,
            get_packaging_project_reports,
            save_packaging_project_reports,
            save_project_verification_doc,
            refresh_packaging_project_lines,
            save_chat_log,
            send_email_report,
            read_local_file_base64,

            read_offline_projects_cache,
            write_offline_projects_cache,
            get_packaging_projects_summary,
            get_packaging_project_details,
            save_session_approval_info,
            reset_session_approval_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_percent_decode() {
        assert_eq!(percent_decode("test%40example.com"), "test@example.com");
        assert_eq!(percent_decode("hello+world"), "hello world");
        assert_eq!(percent_decode("john%20doe"), "john doe");
    }
}



