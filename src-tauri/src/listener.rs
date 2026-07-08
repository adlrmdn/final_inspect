use postgres::{Client, NoTls};
use postgres::fallible_iterator::FallibleIterator;
use tauri::Emitter;

/// Runs forever in a dedicated OS thread, reconnecting on any error.
/// Forwards every pg_notify('qms_updates', ...) payload to the Tauri frontend
/// as a `packaging-project-updated` event so the UI can refresh without polling.
pub fn start(app_handle: tauri::AppHandle) {
    loop {
        match connect_and_listen(&app_handle) {
            Ok(_) => {
                // Clean disconnect — reconnect in case the server restarted
                eprintln!("[QMS Listener] Connection closed. Reconnecting in 5s...");
            }
            Err(e) => {
                eprintln!("[QMS Listener] {e}. Reconnecting in 5s...");
            }
        }
        std::thread::sleep(std::time::Duration::from_secs(5));
    }
}

fn connect_and_listen(app_handle: &tauri::AppHandle) -> Result<(), postgres::Error> {
    let mut client = Client::connect(crate::db::QMS_DB_URL, NoTls)?;
    client.execute("LISTEN qms_updates", &[])?;

    // `blocking_iter` parks this thread until a notification or connection error arrives.
    // No CPU is consumed while waiting.
    let mut notifications = client.notifications();
    let mut iter = notifications.blocking_iter();
    loop {
        match iter.next() {
            Ok(Some(n)) => {
                let _ = app_handle.emit::<String>("packaging-project-updated", n.payload().to_string());
            }
            Ok(None) => return Ok(()), // server closed the connection cleanly
            Err(e) => return Err(e),
        }
    }
}
