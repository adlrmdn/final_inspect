use postgres::{Client, NoTls};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::NaiveDateTime;
use tauri::{AppHandle, Manager};
use std::sync::OnceLock;

static DB_INIT: OnceLock<()> = OnceLock::new();

fn ensure_init() {
    DB_INIT.get_or_init(|| { let _ = init_tables(); });
}

// PostgreSQL Database Connection URL configurations
const VSM_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/vsm";
pub(crate) const QMS_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/qms";
const POSTGRES_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/postgres";
const RPA_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/rpa";


// Struct representing a QC Inspection Template
#[derive(Debug, Serialize, Deserialize)]
pub struct QcTemplate {
    pub id: String,
    pub title: String,
    pub version: String,
    pub description: String,
    pub fields: Value,
}

// Struct representing a QC Inspection Report
#[derive(Debug, Serialize, Deserialize)]
pub struct QcReport {
    pub id: String,
    pub template_id: String,
    pub operator_id: String,
    pub payload: Value,
    pub status: String,
    pub created_at: String,
}

// Struct representing an active PLM Activity
#[derive(Debug, Serialize, Deserialize)]
pub struct ActivePlmActivity {
    pub plm_id: String,
    pub brand: String,
    pub season: String,
    pub article_name: String,
    pub production_group: Option<String>,
    pub po_info: Option<String>,
    pub po_qty: Option<f64>,
    pub po_plan_date: Option<String>,
    pub po_vendor: Option<String>,
    pub production_type: Option<String>,
}

// Struct representing a downloaded production style line item
#[derive(Debug, Serialize, Deserialize)]
pub struct PlmActivityItem {
    pub prod_id: String,
    pub item_id: String,
    pub size: String,
    pub qty: i32,
    pub bom_id: String,
    pub invent_location_id: String,
}

// Struct representing the Main Packaging Project
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingProject {
    pub project_id: String,
    pub plm_id: String,
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub season: String,
    #[serde(default)]
    pub article_name: String,
    #[serde(default)]
    pub production_group: String,
    #[serde(default)]
    pub po_info: Option<String>,
    #[serde(default)]
    pub po_qty: Option<f64>,
    #[serde(default)]
    pub po_plan_date: Option<String>,
    #[serde(default)]
    pub po_vendor: Option<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub cmt_cut_job_id: Option<String>,
    #[serde(default)]
    pub cmt_pak_job_id: Option<String>,
    #[serde(default)]
    pub sales_price: Option<f64>,
    #[serde(default)]
    pub verified_doc: Option<String>,
    #[serde(default)]
    pub has_deduction: Option<bool>,
    #[serde(default)]
    pub deduction_amount: Option<f64>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

// Struct representing a Packaging Project Session Report Row (JobTransactionLinesDetails mapped)
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingProjectReport {
    pub report_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    pub project_id: String,
    #[serde(default)]
    pub data_area_id: Option<String>,
    #[serde(default)]
    pub line_no: Option<i32>,
    #[serde(default)]
    pub job_transaction_id: Option<String>,
    #[serde(default)]
    pub item_id: Option<String>,
    #[serde(default)]
    pub size_val: Option<String>,
    #[serde(default)]
    pub global_display_order: Option<i32>,
    #[serde(default)]
    pub reject_produksi: Option<i32>,
    #[serde(default)]
    pub reject_finishing: Option<i32>,
    #[serde(default)]
    pub reject_embro: Option<i32>,
    #[serde(default)]
    pub qty_order: Option<i32>,
    #[serde(default)]
    pub total_qty_sample: Option<i32>,
    #[serde(default)]
    pub barang_hilang: Option<i32>,
    #[serde(default)]
    pub reject_cutting: Option<i32>,
    #[serde(default)]
    pub total_reject_qty: Option<i32>,
    #[serde(default)]
    pub reject_printing: Option<i32>,
    #[serde(default)]
    pub ref_rec_id: Option<i64>,
    #[serde(default)]
    pub total_good_qty: Option<i32>,
    #[serde(default)]
    pub reject_sewing: Option<i32>,
    #[serde(default)]
    pub reject_washing: Option<i32>,
    #[serde(default)]
    pub gramasi: Option<f64>,
    #[serde(default)]
    pub btj: Option<i32>,
    #[serde(default)]
    pub reject_bahan: Option<i32>,
    pub session_qty: f64,
    #[serde(default)]
    pub session_version: Option<String>,
    pub created_at: String,
}

// Struct representing a Packaging Project Session (QC Cycle with checklist & metrics)
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingProjectSession {
    pub session_id: String,
    pub project_id: String,
    #[serde(default)]
    pub cycle_number: i32,
    #[serde(default)]
    pub inspector_id: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub started_at: String,
    #[serde(default)]
    pub ended_at: Option<String>,
    
    // Date fields
    #[serde(default)]
    pub inspection_date: Option<String>,
    
    // Checklist fields (Booleans)
    #[serde(default)]
    pub check_wash: bool,
    #[serde(default)]
    pub check_style_as_sample: bool,
    #[serde(default)]
    pub check_main_label: bool,
    #[serde(default)]
    pub check_flag_fit_label: bool,
    #[serde(default)]
    pub check_print_embro_artwork: bool,
    #[serde(default)]
    pub check_hangtag: bool,
    #[serde(default)]
    pub check_waist_tag: bool,
    #[serde(default)]
    pub check_barcode: bool,
    #[serde(default)]
    pub check_packing_list: bool,
    #[serde(default)]
    pub check_shipping_mark: bool,
    #[serde(default)]
    pub check_other_1: bool,
    #[serde(default)]
    pub check_other_1_label: Option<String>,
    #[serde(default)]
    pub check_other_2: bool,
    #[serde(default)]
    pub check_other_2_label: Option<String>,
    
    // Number fill int fields
    #[serde(default)]
    pub qty_available: i32,
    #[serde(default)]
    pub total_store: i32,
    #[serde(default)]
    pub store_inspected: i32,
    #[serde(default)]
    pub cutting_pcs: i32,
    #[serde(default)]
    pub sewing_pcs: i32,
    #[serde(default)]
    pub finishing_pcs: i32,
    #[serde(default)]
    pub packing_pcs: i32,
    #[serde(default)]
    pub sampling_pcs: i32,
    
    // Number fill float fields
    #[serde(default)]
    pub aql: f64,
    #[serde(default)]
    pub level_val: f64,
    
    // Text fields
    #[serde(default)]
    pub factory_representative: Option<String>,
    #[serde(default)]
    pub inspector: Option<String>,
    
    // Status fields
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
    // Optimistic concurrency version — incremented on every successful save
    #[serde(default)]
    pub row_version: Option<i32>,
}

// Struct representing a Packaging Defect Image
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingDefectImage {
    pub image_id: String,
    pub project_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub image_path: String,
    #[serde(default)]
    pub defect_type: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub major: i32,
    #[serde(default)]
    pub minor: i32,
    #[serde(default)]
    pub captured_at: String,
}

// PackagingProjectReport struct is defined above

// Connect to VSM Reference Database
fn get_connection_vsm() -> Result<Client, String> {
    use std::time::Duration;
    use std::str::FromStr;
    let mut config = postgres::Config::from_str(VSM_DB_URL)
        .map_err(|e| format!("Invalid VSM config: {}", e))?;
    config.connect_timeout(Duration::from_millis(1500));
    config.connect(NoTls).map_err(|e| format!("Failed to connect to VSM reference DB: {}", e))
}

// Connect to QMS Workspace Database (with lazy auto-bootstrap database creation)
fn get_connection_qms() -> Result<Client, String> {
    use std::time::Duration;
    use std::str::FromStr;
    let mut config = postgres::Config::from_str(QMS_DB_URL)
        .map_err(|e| format!("Invalid QMS config: {}", e))?;
    config.connect_timeout(Duration::from_millis(1500));

    match config.connect(NoTls) {
        Ok(c) => Ok(c),
        Err(e) => {
            let err_str = e.to_string();
            // If connection failed because database "qms" does not exist, connect to postgres and create it
            if err_str.contains("database \"qms\" does not exist") {
                let mut root_config = postgres::Config::from_str(POSTGRES_DB_URL)
                    .map_err(|e2| format!("Invalid Postgres config: {}", e2))?;
                root_config.connect_timeout(Duration::from_millis(1500));
                match root_config.connect(NoTls) {
                    Ok(mut root_client) => {
                        let _ = root_client.execute("CREATE DATABASE qms", &[]);
                        // Re-attempt connecting to qms DB
                        config.connect(NoTls).map_err(|e2| format!("QMS database created, but failed to connect: {}", e2))
                    }
                    Err(root_err) => Err(format!("QMS database does not exist and failed to connect to master postgres to create it: {}", root_err))
                }
            } else {
                Err(format!("Failed to connect to QMS workspace DB: {}", e))
            }
        }
    }
}

// Connect to RPA Database (with lazy auto-bootstrap database creation)
fn get_connection_rpa() -> Result<Client, String> {
    use std::time::Duration;
    use std::str::FromStr;
    let mut config = postgres::Config::from_str(RPA_DB_URL)
        .map_err(|e| format!("Invalid RPA config: {}", e))?;
    config.connect_timeout(Duration::from_millis(1500));

    match config.connect(NoTls) {
        Ok(c) => Ok(c),
        Err(e) => {
            let err_str = e.to_string();
            // If connection failed because database "rpa" does not exist, connect to postgres and create it
            if err_str.contains("database \"rpa\" does not exist") {
                let mut root_config = postgres::Config::from_str(POSTGRES_DB_URL)
                    .map_err(|e2| format!("Invalid Postgres config: {}", e2))?;
                root_config.connect_timeout(Duration::from_millis(1500));
                match root_config.connect(NoTls) {
                    Ok(mut root_client) => {
                        let _ = root_client.execute("CREATE DATABASE rpa", &[]);
                        // Re-attempt connecting to rpa DB
                        config.connect(NoTls).map_err(|e2| format!("RPA database created, but failed to connect: {}", e2))
                    }
                    Err(root_err) => Err(format!("RPA database does not exist and failed to connect to master postgres to create it: {}", root_err))
                }
            } else {
                Err(format!("Failed to connect to RPA DB: {}", e))
            }
        }
    }
}


// Initialize tables inside RPA Database if they do not exist
pub fn init_rpa_tables() -> Result<(), String> {
    let mut client = get_connection_rpa()?;
    
    // Create rpa_queues table in RPA DB
    client.execute(
        "CREATE TABLE IF NOT EXISTS rpa_queues (
            id SERIAL PRIMARY KEY,
            entity_type VARCHAR(100) NOT NULL,
            entity_id VARCHAR(100) NOT NULL,
            rpa_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            payload JSONB,
            attempts INT NOT NULL DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )",
        &[],
    ).map_err(|e| format!("Failed to create rpa_queues table in RPA DB: {}", e))?;

    // Create index for fast polling
    client.execute(
        "CREATE INDEX IF NOT EXISTS idx_rpa_queues_polling ON rpa_queues(status, rpa_type)",
        &[],
    ).map_err(|e| format!("Failed to create idx_rpa_queues_polling index: {}", e))?;

    Ok(())
}

// Initialize tables inside QMS Database if they do not exist
pub fn init_tables() -> Result<(), String> {
    let _ = init_rpa_tables(); // Lazily ensure RPA DB and schema exist
    let mut client = get_connection_qms()?;

    
    // Create templates table inside QMS
    client.execute(
        "CREATE TABLE IF NOT EXISTS qc_templates (
            id VARCHAR(100) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            version VARCHAR(50) NOT NULL,
            description TEXT,
            fields JSONB NOT NULL
        )",
        &[],
    ).map_err(|e| format!("Failed to create qc_templates table in QMS: {}", e))?;

    // Create reports table inside QMS
    client.execute(
        "CREATE TABLE IF NOT EXISTS qc_reports (
            id VARCHAR(100) PRIMARY KEY,
            template_id VARCHAR(100) NOT NULL,
            operator_id VARCHAR(100) NOT NULL,
            payload JSONB NOT NULL,
            status VARCHAR(50) NOT NULL,
            created_at TIMESTAMP NOT NULL
        )",
        &[],
    ).map_err(|e| format!("Failed to create qc_reports table in QMS: {}", e))?;



    // 1. Create packaging_projects table
    client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_projects (
            project_id VARCHAR(100) PRIMARY KEY,
            plm_id VARCHAR(100) NOT NULL,
            brand VARCHAR(100) NOT NULL,
            season VARCHAR(100) NOT NULL,
            article_name VARCHAR(255) NOT NULL,
            production_group VARCHAR(100) NOT NULL,
            po_info VARCHAR(100),
            po_qty DOUBLE PRECISION,
            po_plan_date VARCHAR(50),
            po_vendor VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            cmt_cut_job_id VARCHAR(100),
            cmt_pak_job_id VARCHAR(100),
            sales_price DOUBLE PRECISION,
            verified_doc TEXT,
            has_deduction BOOLEAN NOT NULL DEFAULT FALSE,
            deduction_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )",
        &[],
    ).map_err(|e| format!("Failed to create packaging_projects table in QMS: {}", e))?;

    // 2. Create packaging_project_sessions table
    client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_project_sessions (
            session_id VARCHAR(100) PRIMARY KEY,
            project_id VARCHAR(100) NOT NULL REFERENCES packaging_projects(project_id) ON DELETE CASCADE,
            cycle_number INT NOT NULL,
            inspector_id VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL,
            started_at TIMESTAMP NOT NULL DEFAULT NOW(),
            ended_at TIMESTAMP,
            
            -- Date fields
            inspection_date DATE,
            
            -- Checklist fields (Booleans)
            check_wash BOOLEAN NOT NULL DEFAULT FALSE,
            check_style_as_sample BOOLEAN NOT NULL DEFAULT FALSE,
            check_main_label BOOLEAN NOT NULL DEFAULT FALSE,
            check_flag_fit_label BOOLEAN NOT NULL DEFAULT FALSE,
            check_print_embro_artwork BOOLEAN NOT NULL DEFAULT FALSE,
            check_hangtag BOOLEAN NOT NULL DEFAULT FALSE,
            check_waist_tag BOOLEAN NOT NULL DEFAULT FALSE,
            check_barcode BOOLEAN NOT NULL DEFAULT FALSE,
            check_packing_list BOOLEAN NOT NULL DEFAULT FALSE,
            check_shipping_mark BOOLEAN NOT NULL DEFAULT FALSE,
            check_other_1 BOOLEAN NOT NULL DEFAULT FALSE,
            check_other_1_label VARCHAR(255),
            check_other_2 BOOLEAN NOT NULL DEFAULT FALSE,
            check_other_2_label VARCHAR(255),
            
            -- Number fill int fields
            qty_available INT NOT NULL DEFAULT 0,
            total_store INT NOT NULL DEFAULT 0,
            store_inspected INT NOT NULL DEFAULT 0,
            cutting_pcs INT NOT NULL DEFAULT 0,
            sewing_pcs INT NOT NULL DEFAULT 0,
            finishing_pcs INT NOT NULL DEFAULT 0,
            packing_pcs INT NOT NULL DEFAULT 0,
            sampling_pcs INT NOT NULL DEFAULT 0,
            
            -- Number fill float fields
            aql DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            level_val DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            
            -- Text fields
            factory_representative VARCHAR(255),
            inspector VARCHAR(255),
            
            -- Status fields
            version VARCHAR(50),
            result VARCHAR(50)
        )",
        &[],
    ).map_err(|e| format!("Failed to create packaging_project_sessions table in QMS: {}", e))?;

    // 3. Create packaging_defect_images table
    client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_defect_images (
            image_id VARCHAR(100) PRIMARY KEY,
            project_id VARCHAR(100) NOT NULL REFERENCES packaging_projects(project_id) ON DELETE CASCADE,
            session_id VARCHAR(100) REFERENCES packaging_project_sessions(session_id) ON DELETE SET NULL,
            image_path TEXT NOT NULL,
            defect_type VARCHAR(100) NOT NULL,
            description TEXT,
            major INT NOT NULL DEFAULT 0,
            minor INT NOT NULL DEFAULT 0,
            captured_at TIMESTAMP NOT NULL DEFAULT NOW()
        )",
        &[],
    ).map_err(|e| format!("Failed to create packaging_defect_images table in QMS: {}", e))?;

    // Perform safe migrations for defect images
    let _ = client.execute("ALTER TABLE packaging_defect_images ADD COLUMN IF NOT EXISTS description TEXT", &[]);
    let _ = client.execute("ALTER TABLE packaging_defect_images ADD COLUMN IF NOT EXISTS major INT NOT NULL DEFAULT 0", &[]);
    let _ = client.execute("ALTER TABLE packaging_defect_images ADD COLUMN IF NOT EXISTS minor INT NOT NULL DEFAULT 0", &[]);

    // Perform migrations on packaging_projects
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS cmt_cut_job_id VARCHAR(100)", &[]);
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS cmt_pak_job_id VARCHAR(100)", &[]);
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS sales_price DOUBLE PRECISION", &[]);
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS verified_doc TEXT", &[]);
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS has_deduction BOOLEAN NOT NULL DEFAULT FALSE", &[]);
    let _ = client.execute("ALTER TABLE packaging_projects ADD COLUMN IF NOT EXISTS deduction_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0", &[]);

    // Perform migrations on packaging_project_sessions
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS check_other_1 BOOLEAN NOT NULL DEFAULT FALSE", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS check_other_1_label VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS check_other_2 BOOLEAN NOT NULL DEFAULT FALSE", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS check_other_2_label VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approval_source VARCHAR(255) DEFAULT 'web_portal'", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approval_token UUID", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approval_email VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS approval_signature VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS ho_approval_signature VARCHAR(255)", &[]);
    // Director stage (stage 3): portal writes the signature ('Digitally Signed:'/'Rejected:' prefix,
    // same contract as ho_approval_signature); console writes inspector_email from the device profile.
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS director_approval_signature VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS inspector_email VARCHAR(255)", &[]);
    // Optimistic concurrency lock — incremented on every save; 0/NULL clients bypass the check
    let _ = client.execute("ALTER TABLE packaging_project_sessions ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1", &[]);

    // Real-time LISTEN/NOTIFY infrastructure — fires whenever any writer (console or portal) changes a session or fabric row
    let _ = client.execute(
        "CREATE OR REPLACE FUNCTION notify_qms_update() RETURNS trigger AS $fn$
         BEGIN
           PERFORM pg_notify('qms_updates', json_build_object(
             'table',      TG_TABLE_NAME,
             'project_id', COALESCE(NEW.project_id::text, '')
           )::text);
           RETURN NEW;
         END;
         $fn$ LANGUAGE plpgsql",
        &[],
    );
    let _ = client.execute("DROP TRIGGER IF EXISTS trg_qms_notify_sessions ON packaging_project_sessions", &[]);
    let _ = client.execute(
        "CREATE TRIGGER trg_qms_notify_sessions AFTER INSERT OR UPDATE ON packaging_project_sessions FOR EACH ROW EXECUTE FUNCTION notify_qms_update()",
        &[],
    );
    let _ = client.execute("DROP TRIGGER IF EXISTS trg_qms_notify_fabric ON packaging_project_fabric_lines", &[]);
    let _ = client.execute(
        "CREATE TRIGGER trg_qms_notify_fabric AFTER INSERT OR UPDATE ON packaging_project_fabric_lines FOR EACH ROW EXECUTE FUNCTION notify_qms_update()",
        &[],
    );

    // packaging_project_fabric_lines: fabric tracking data written by external systems, displayed beneath yield matrix
    let _ = client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_project_fabric_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id VARCHAR(100) REFERENCES packaging_projects(project_id) ON DELETE CASCADE,
            label VARCHAR(255),
            fabric_sent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            consumption_plan DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            cutt_plan DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            actual_consumption DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            short_roll DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            sisa_kain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            kepala_kain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            return_kain DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )",
        &[],
    );

    // Portal publish contract migrations: staged rows arrive with project_id=NULL keyed by production_group
    let _ = client.execute("ALTER TABLE packaging_project_fabric_lines ALTER COLUMN project_id DROP NOT NULL", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_fabric_lines ADD COLUMN IF NOT EXISTS production_group VARCHAR(100)", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_fabric_lines ADD COLUMN IF NOT EXISTS overconsumption DOUBLE PRECISION", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_fabric_lines ADD COLUMN IF NOT EXISTS fabric_price DOUBLE PRECISION", &[]);
    let _ = client.execute("ALTER TABLE packaging_project_fabric_lines ADD COLUMN IF NOT EXISTS deduction DOUBLE PRECISION", &[]);
    let _ = client.execute("CREATE INDEX IF NOT EXISTS idx_fabric_lines_production_group ON packaging_project_fabric_lines(production_group)", &[]);

    // packaging_session_deduction_lines: manual deduction line items written by external systems
    let _ = client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_session_deduction_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id VARCHAR(100) NOT NULL REFERENCES packaging_project_sessions(session_id) ON DELETE CASCADE,
            description TEXT NOT NULL,
            amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            created_by VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )",
        &[],
    );

    // packaging_project_remarks: staged remarks keyed by production_group (portal publishes, console reads)
    let _ = client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_project_remarks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            production_group VARCHAR(100) UNIQUE NOT NULL,
            project_id VARCHAR(100),
            remarks TEXT,
            updated_by VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )",
        &[],
    );

    // 4. Create packaging_project_reports table (Session-level & project-level QC OData cycle reports)
    client.execute(
        "CREATE TABLE IF NOT EXISTS packaging_project_reports (
            report_id VARCHAR(100) PRIMARY KEY,
            session_id VARCHAR(100),
            project_id VARCHAR(100) NOT NULL REFERENCES packaging_projects(project_id) ON DELETE CASCADE,
            data_area_id VARCHAR(50),
            line_no INT,
            job_transaction_id VARCHAR(100),
            item_id VARCHAR(100),
            size_val VARCHAR(50),
            global_display_order INT,
            reject_produksi INT,
            reject_finishing INT,
            reject_embro INT,
            qty_order INT,
            total_qty_sample INT,
            barang_hilang INT,
            reject_cutting INT,
            total_reject_qty INT,
            reject_printing INT,
            ref_rec_id BIGINT,
            total_good_qty INT,
            reject_sewing INT,
            reject_washing INT,
            gramasi DOUBLE PRECISION,
            btj INT,
            reject_bahan INT,
            session_qty DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            session_version VARCHAR(100) DEFAULT 'v1.0',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )",
        &[],
    ).map_err(|e| format!("Failed to create packaging_project_reports table in QMS: {}", e))?;

    // Safe migration: Drop session_id constraint from packaging_project_reports if it exists
    let _ = client.execute("ALTER TABLE packaging_project_reports DROP CONSTRAINT IF EXISTS packaging_project_reports_session_id_fkey", &[]);

    // Drop unused packaging_base_reports table
    let _ = client.execute("DROP TABLE IF EXISTS packaging_base_reports CASCADE", &[]);

    // Self-healing database sweep: clean up any duplicate size-level report rows for the same session across all projects
    let _ = client.execute(
        "DELETE FROM packaging_project_reports a
         WHERE a.ctid NOT IN (
             SELECT max(b.ctid)
             FROM packaging_project_reports b
             WHERE b.project_id = a.project_id
               AND COALESCE(b.session_id, '') = COALESCE(a.session_id, '')
               AND b.size_val = a.size_val
         )",
        &[]
    );

    // 5. Create chat_logs table to record chat interactions
    client.execute(
        "CREATE TABLE IF NOT EXISTS chat_logs (
            id SERIAL PRIMARY KEY,
            project_id VARCHAR(100),
            session_id VARCHAR(100),
            sender VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            thinking TEXT,
            context VARCHAR(255),
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )",
        &[],
    ).map_err(|e| format!("Failed to create chat_logs table in QMS: {}", e))?;

    // Perform safe migrations on chat_logs
    let _ = client.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS project_id VARCHAR(100)", &[]);
    let _ = client.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)", &[]);
    let _ = client.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS thinking TEXT", &[]);
    let _ = client.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS context VARCHAR(255)", &[]);
    let _ = client.execute("ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()", &[]);

    Ok(())
}

// Save a chat log interaction in QMS database
pub fn save_chat_log(project_id: Option<String>, session_id: Option<String>, sender: String, message: String) -> Result<(), String> {
    let mut client = get_connection_qms()?;
    client.execute(
        "INSERT INTO chat_logs (project_id, session_id, sender, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())",
        &[&project_id, &session_id, &sender, &message],
    ).map_err(|e| format!("Failed to save chat log: {}", e))?;
    Ok(())
}

// Check QMS database connection health
pub fn check_connection() -> Result<(), String> {
    let _client = get_connection_qms()?;
    Ok(())
}

// Save or update a QC Template inside QMS (UPSERT)
pub fn save_template(template: QcTemplate) -> Result<(), String> {
    ensure_init(); // Lazily ensure QMS schema exists
    let mut client = get_connection_qms()?;
    
    client.execute(
        "INSERT INTO qc_templates (id, title, version, description, fields)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) 
         DO UPDATE SET title = $2, version = $3, description = $4, fields = $5",
        &[
            &template.id,
            &template.title,
            &template.version,
            &template.description,
            &template.fields,
        ],
    ).map_err(|e| format!("Failed to save template to QMS: {}", e))?;

    Ok(())
}

// Retrieve all QC Templates from QMS
pub fn get_templates() -> Result<Vec<QcTemplate>, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    let mut templates = Vec::new();

    let rows = client.query("SELECT id, title, version, description, fields FROM qc_templates", &[])
        .map_err(|e| format!("Failed to query templates from QMS: {}", e))?;

    for row in rows {
        templates.push(QcTemplate {
            id: row.get(0),
            title: row.get(1),
            version: row.get(2),
            description: row.get(3),
            fields: row.get(4),
        });
    }

    Ok(templates)
}

// Save or update a QC Report inside QMS (UPSERT)
pub fn save_report(report: QcReport) -> Result<(), String> {
    ensure_init(); // Lazily ensure QMS schema exists
    let mut client = get_connection_qms()?;
    
    let parsed_time = NaiveDateTime::parse_from_str(&report.created_at, "%Y-%m-%dT%H:%M:%S%.3fZ")
        .or_else(|_| NaiveDateTime::parse_from_str(&report.created_at, "%Y-%m-%dT%H:%M:%SZ"))
        .or_else(|_| NaiveDateTime::parse_from_str(&report.created_at, "%Y-%m-%d %H:%M:%S"))
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc());

    client.execute(
        "INSERT INTO qc_reports (id, template_id, operator_id, payload, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) 
         DO UPDATE SET template_id = $2, operator_id = $3, payload = $4, status = $5, created_at = $6",
        &[
            &report.id,
            &report.template_id,
            &report.operator_id,
            &report.payload,
            &report.status,
            &parsed_time,
        ],
    ).map_err(|e| format!("Failed to save report to QMS: {}", e))?;

    Ok(())
}

// Retrieve all QC Reports from QMS
pub fn get_reports() -> Result<Vec<QcReport>, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    let mut reports = Vec::new();

    let rows = client.query("SELECT id, template_id, operator_id, payload, status, created_at FROM qc_reports ORDER BY created_at DESC", &[])
        .map_err(|e| format!("Failed to query reports from QMS: {}", e))?;

    for row in rows {
        let naive_time: NaiveDateTime = row.get(5);
        let time_str = naive_time.format("%Y-%m-%dT%H:%M:%S.000Z").to_string();

        reports.push(QcReport {
            id: row.get(0),
            template_id: row.get(1),
            operator_id: row.get(2),
            payload: row.get(3),
            status: row.get(4),
            created_at: time_str,
        });
    }

    Ok(reports)
}

// Query running and non-shadowed styles directly from the VSM database
pub fn get_active_plm_activities() -> Result<Vec<ActivePlmActivity>, String> {
    let mut client = get_connection_vsm()?;
    
    let mut list = Vec::new();
    let rows = client.query(
        "SELECT pa.\"PLMId\" AS \"PLMId\",
                pa.\"Brand\" AS \"Brand\",
                pa.\"Season\" AS \"Season\",
                pa.\"ArticleName\" AS \"ArticleName\",
                pa.\"ProductionGroup\" AS \"ProductionGroup\",
                string_agg(DISTINCT ph.\"PurchaseOrderNumber\", ', ') AS \"PurchaseOrderNumber\",
                sum(pl.\"OrderedPurchaseQuantity\")::float8 AS \"OrderedQty\",
                substring(min(ph.\"RequestedDeliveryDate\") from 1 for 10) AS \"PlanDate\",
                string_agg(DISTINCT ph.\"PurchaseOrderName\", ', ') AS \"Vendor\",
                pa.\"ProductionType\" AS \"ProductionType\"
         FROM plm_activity pa
         LEFT JOIN po_lines pl ON pa.\"PLMId\" = pl.\"PLMId\" AND pl.\"LineDescription\" = 'Item Jasa CMT'
         LEFT JOIN po_headers ph ON pl.\"PurchaseOrderNumber\" = ph.\"PurchaseOrderNumber\"
         WHERE pa.\"PLMActivityStatus\" = 'Started' 
           AND pa.\"ProductionGroup\" IS NOT NULL
           AND pa.\"ProductionGroup\" != ''
           AND pa.\"ProductionType\" IN ('CMT', 'In-house')
           AND pa.\"PLMId\" NOT IN (SELECT \"PLMId\" FROM plm_activity_shadowing)
         GROUP BY pa.\"PLMId\", pa.\"Brand\", pa.\"Season\", pa.\"ArticleName\", pa.\"ProductionGroup\", pa.\"ProductionType\"

         UNION ALL

         SELECT COALESCE(pgl.\"ItemId\", '') AS \"PLMId\",
                'N/A' AS \"Brand\",
                'N/A' AS \"Season\",
                COALESCE(pgl.\"SearchName\", 'N/A') AS \"ArticleName\",
                pgl.\"ProductionGroup\" AS \"ProductionGroup\",
                string_agg(DISTINCT pg.\"PONumber\", ', ') AS \"PurchaseOrderNumber\",
                sum(pgl.\"Qty\")::float8 AS \"OrderedQty\",
                substring(min(ph.\"RequestedDeliveryDate\") from 1 for 10) AS \"PlanDate\",
                string_agg(DISTINCT ph.\"PurchaseOrderName\", ', ') AS \"Vendor\",
                COALESCE(pg.\"ProductionType\", 'CMT') AS \"ProductionType\"
         FROM production_group_lines pgl
         LEFT JOIN production_groups pg ON pgl.\"ProductionGroup\" = pg.\"ProductionGroup\"
         LEFT JOIN po_headers ph ON pg.\"PONumber\" = ph.\"PurchaseOrderNumber\"
         WHERE pgl.\"ProdStatus\" = 'StartedUp'
           AND pgl.\"ProductionGroup\" IS NOT NULL
           AND pgl.\"ProductionGroup\" != ''
           AND pgl.\"ProductionGroup\" NOT IN (SELECT DISTINCT \"ProductionGroup\" FROM plm_activity WHERE \"ProductionGroup\" IS NOT NULL)
         GROUP BY pgl.\"ProductionGroup\", pgl.\"ItemId\", pgl.\"SearchName\", pg.\"ProductionType\"
         ORDER BY \"ProductionGroup\" DESC", 
        &[]
    ).map_err(|e| format!("Failed to query active plm_activities: {}", e))?;

    for row in rows {
        list.push(ActivePlmActivity {
            plm_id: row.get(0),
            brand: row.get::<_, Option<String>>(1).unwrap_or_default(),
            season: row.get::<_, Option<String>>(2).unwrap_or_default(),
            article_name: row.get::<_, Option<String>>(3).unwrap_or_default(),
            production_group: row.get(4),
            po_info: row.get(5),
            po_qty: row.get(6),
            po_plan_date: row.get(7),
            po_vendor: row.get(8),
            production_type: row.get(9),
        });
    }

    Ok(list)
}

// Fetch reference line item sizes/quantities from VSM
pub fn get_plm_activity_items(plm_id: &str) -> Result<Vec<PlmActivityItem>, String> {
    let mut client = get_connection_vsm()?;

    let rows = client.query(
        "SELECT \"ProdId\", \"ItemId\", \"Size\", \"Qty\", \"BOMId\", \"InventLocationId\"
         FROM production_group_lines
         WHERE \"ProductionGroup\" = (SELECT \"ProductionGroup\" FROM plm_activity WHERE \"PLMId\" = $1)",
        &[&plm_id],
    ).map_err(|e| format!("Failed to query line items for PLM: {}", e))?;

    let mut list = Vec::new();
    for row in rows {
        list.push(PlmActivityItem {
            prod_id: row.get(0),
            item_id: row.get(1),
            size: row.get(2),
            qty: row.get(3),
            bom_id: row.get(4),
            invent_location_id: row.get(5),
        });
    }
    
    Ok(list)
}



// -------------------------------------------------------------
// NEW PACKAGING QC PROJECT & SESSION OPERATIONS
// -------------------------------------------------------------

/// Server-side gate for the completed-project transition. Mirrors the console's
/// `isFullyVerified` check (Stage 1 factory-rep signature + Stage 2 HO signature)
/// but reads the columns the portal actually wrote in the DB, rather than trusting
/// whatever session state the client happened to send. Without this, any caller of
/// save_packaging_project[_db_only] could mark a project 'completed' (and trigger
/// the RPA invoice queue) without either signature ever existing.
fn latest_session_is_fully_verified(client: &mut postgres::Client, project_id: &str) -> bool {
    let row = client.query_opt(
        "SELECT approval_status, approval_signature, ho_approval_signature
         FROM packaging_project_sessions
         WHERE project_id = $1
         ORDER BY cycle_number DESC
         LIMIT 1",
        &[&project_id],
    );
    let row = match row {
        Ok(Some(r)) => r,
        _ => return false,
    };
    let approval_status: Option<String> = row.get(0);
    let approval_signature: Option<String> = row.get(1);
    let ho_approval_signature: Option<String> = row.get(2);

    let stage1_done = approval_status.as_deref() == Some("approved")
        || approval_signature
            .as_deref()
            .map(|s| s.to_lowercase().contains("digitally signed"))
            .unwrap_or(false);
    let stage2_done = ho_approval_signature
        .as_deref()
        .map(|s| s.contains("Digitally Signed:"))
        .unwrap_or(false);

    stage1_done && stage2_done
}

/// DB-only upsert for existing projects when D365 is unreachable.
/// Preserves existing job IDs and sales_price; updates status/deductions/timestamp.
fn save_packaging_project_db_only(mut client: postgres::Client, project: PackagingProject) -> Result<String, String> {
    // Resolve project_id and preserve existing job IDs from DB
    let mut project_id = project.project_id.clone();
    let mut final_cut_job = project.cmt_cut_job_id.clone();
    let mut final_pak_job = project.cmt_pak_job_id.clone();
    let mut final_sales_price = project.sales_price.unwrap_or(0.0);

    let mut db_was_completed = false;
    if let Ok(row) = client.query_one(
        "SELECT project_id, cmt_cut_job_id, cmt_pak_job_id, sales_price, status FROM packaging_projects WHERE project_id = $1 OR production_group = $2 ORDER BY created_at DESC LIMIT 1",
        &[&project.project_id, &project.production_group],
    ) {
        project_id = row.get(0);
        let db_cut: Option<String> = row.get(1);
        let db_pak: Option<String> = row.get(2);
        let db_price: Option<f64> = row.get(3);
        let db_status: Option<String> = row.get(4);
        if final_cut_job.is_none() { final_cut_job = db_cut; }
        if final_pak_job.is_none() { final_pak_job = db_pak; }
        if final_sales_price == 0.0 { final_sales_price = db_price.unwrap_or(0.0); }
        db_was_completed = db_status.as_deref() == Some("completed");
    }

    if project.status == "completed" && !db_was_completed && !latest_session_is_fully_verified(&mut client, &project_id) {
        return Err("Cannot complete project: the latest inspection session has not been digitally signed by both the factory representative and the HO approver.".to_string());
    }

    let has_deduction_val = project.has_deduction.unwrap_or(false);
    let deduction_amount_val = project.deduction_amount.unwrap_or(0.0);

    client.execute(
        "INSERT INTO packaging_projects (project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, sales_price, has_deduction, deduction_amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
         ON CONFLICT (project_id)
         DO UPDATE SET status = $11, cmt_cut_job_id = COALESCE($12, packaging_projects.cmt_cut_job_id), cmt_pak_job_id = COALESCE($13, packaging_projects.cmt_pak_job_id), sales_price = CASE WHEN $14 > 0 THEN $14 ELSE packaging_projects.sales_price END, has_deduction = $15, deduction_amount = $16, updated_at = NOW()",
        &[
            &project_id, &project.plm_id, &project.brand, &project.season,
            &project.article_name, &project.production_group,
            &project.po_info, &project.po_qty, &project.po_plan_date, &project.po_vendor,
            &project.status, &final_cut_job, &final_pak_job, &final_sales_price,
            &has_deduction_val, &deduction_amount_val,
        ],
    ).map_err(|e| format!("Failed to save packaging project (db-only): {}", e))?;

    // Adopt any portal-staged fabric lines (project_id=NULL) published before the project existed
    let _ = client.execute(
        "UPDATE packaging_project_fabric_lines SET project_id = $1 WHERE production_group = $2 AND project_id IS NULL",
        &[&project_id, &project.production_group],
    );

    // RPA queueing moved to the portal's approval chain (Director workflow):
    // job_trans_raf fires at MD Production approval, invoice/deduction at
    // Director approval. The console no longer queues OR deletes those jobs on
    // save — a re-save here must never wipe portal-queued work.

    Ok(project_id)
}

/// Lightweight update — only touches deduction fields. No D365 calls.
pub fn update_packaging_project_deductions(project_id: &str, has_deduction: bool, deduction_amount: f64) -> Result<(), String> {
    let mut client = get_connection_qms()?;
    client.execute(
        "UPDATE packaging_projects SET has_deduction = $1, deduction_amount = $2, updated_at = NOW() WHERE project_id = $3",
        &[&has_deduction, &deduction_amount, &project_id],
    ).map_err(|e| format!("Failed to update project deductions: {}", e))?;
    Ok(())
}

pub fn save_packaging_project(project: PackagingProject) -> Result<String, String> {
    ensure_init();
    let mut client = get_connection_qms()?;

    // Check if this project already exists in the DB — used to make D365 calls non-fatal for updates
    let project_exists = client.query_opt(
        "SELECT 1 FROM packaging_projects WHERE project_id = $1 OR production_group = $2 LIMIT 1",
        &[&project.project_id, &project.production_group],
    ).map(|r| r.is_some()).unwrap_or(false);

    // Retrieve credentials and token — non-fatal for existing projects
    let d365_result = get_d365_creds()
        .and_then(|creds| get_d365_token(&creds).map(|token| (creds, token)));

    let (creds, token) = match d365_result {
        Ok(pair) => pair,
        Err(e) => {
            if !project_exists {
                return Err(format!("Failed to connect to D365 (required for new project download): {}", e));
            }
            println!("Warning: D365 unavailable, proceeding with DB-only update for existing project: {}", e);
            // Fall through with empty creds/token — D365-dependent blocks below will be skipped
            // by the presence of existing job IDs in the DB
            return save_packaging_project_db_only(client, project);
        }
    };

    // 1. Fetch job transactions to get CMT-Cut/Pak job IDs and the ArticleId
    let filter_str = format!("ProductionGroup eq '{}'", project.production_group);
    let encoded_filter = percent_encode(&filter_str);
    let headers_url = format!("{}/data/JobTransactionHeaders?$filter={}", creds.resource, encoded_filter);

    let mut cut_job_id = None;
    let mut cut_created = String::new();
    let mut pak_job_id = None;
    let mut pak_created = String::new();
    let mut article_id = None;

    match call_curl_get(&headers_url, &token) {
        Ok(resp) => {
            if let Some(records) = resp["value"].as_array() {
                for rec in records {
                    let op = rec["Operation"].as_str().unwrap_or("");
                    let job_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
                    let created_str = rec["CreatedDateTime1"].as_str().unwrap_or("");
                    let op_upper = op.to_uppercase();
                    if op_upper == "CMT-CUT" {
                        if cut_job_id.is_none() || created_str > cut_created.as_str() {
                            cut_job_id = job_id;
                            cut_created = created_str.to_string();
                        }
                    } else if op_upper == "CMT-PAK" && (pak_job_id.is_none() || created_str > pak_created.as_str()) {
                        pak_job_id = job_id;
                        pak_created = created_str.to_string();
                    }
                    if article_id.is_none() {
                        if let Some(art_id) = rec["ArticleId"].as_str() {
                            if !art_id.is_empty() {
                                article_id = Some(art_id.to_string());
                            }
                        }
                    }
                }
            } else if let Some(err_msg) = resp["error"]["message"].as_str() {
                println!("Warning: Dynamics 365 returned custom OData error: {}", err_msg);
            } else {
                println!("Warning: JobTransactionHeaders response value is not an array: {:?}", resp);
            }
        }
        Err(e) => {
            println!("Warning: Failed to fetch JobTransactionHeaders from D365: {}", e);
        }
    }

    // Resolve final job IDs (prioritize live ERP job transactions if available)
    let mut final_cut_job = cut_job_id.clone().or(project.cmt_cut_job_id.clone());
    let mut final_pak_job = pak_job_id.clone().or(project.cmt_pak_job_id.clone());

    // Fallback: Check if we already have this project recorded in our database
    let mut existing_project_id: Option<String> = None;
    let mut existing_cut_job: Option<String> = None;
    let mut existing_pak_job: Option<String> = None;
    let mut existing_sales_price: Option<f64> = None;
    let mut existing_status: Option<String> = None;

    if let Ok(row) = client.query_one(
        "SELECT project_id, cmt_cut_job_id, cmt_pak_job_id, sales_price, status FROM packaging_projects
         WHERE production_group = $1
         ORDER BY created_at DESC LIMIT 1",
        &[&project.production_group]
    ) {
        existing_project_id = Some(row.get(0));
        existing_cut_job = row.get(1);
        existing_pak_job = row.get(2);
        existing_sales_price = row.get(3);
        existing_status = row.get(4);
    }

    // Assign fallback job IDs from existing database records if ERP returned none
    if final_cut_job.is_none() {
        final_cut_job = existing_cut_job;
    }
    if final_pak_job.is_none() {
        final_pak_job = existing_pak_job;
    }

    // Strict validation: if both final job IDs are None, throw the error
    if final_cut_job.is_none() && final_pak_job.is_none() {
        return Err("No active job transactions (CMT-Cut or CMT-Pak) found for this production group in Microsoft Dynamics 365. Job transactions are required to start this style.".to_string());
    }

    // Resolve sales price with database query fallback if D365 fetch fails
    let mut sales_price = project.sales_price.or(existing_sales_price);
    if sales_price.is_none() {
        let mut resolved_article_id = article_id.clone();
        if resolved_article_id.is_none() {
            // Fallback: Query VSM database plm_activity for ArticleCode (ItemNumber equivalent)
            if let Ok(mut vsm_client) = get_connection_vsm() {
                if let Ok(row) = vsm_client.query_one(
                    "SELECT \"ArticleCode\" FROM plm_activity WHERE \"PLMId\" = $1 OR \"ProductionGroup\" = $2 LIMIT 1",
                    &[&project.plm_id, &project.production_group]
                ) {
                    let art_code: Option<String> = row.get(0);
                    resolved_article_id = art_code;
                }
            }
        }

        if let Some(ref final_article_id) = resolved_article_id {
            match fetch_odata_sales_price(&creds, &token, final_article_id) {
                Ok(price) => {
                    sales_price = Some(price);
                }
                Err(e) => {
                    println!("Warning: Failed to fetch sales price from D365 ERP: {}. Trying VSM fallback.", e);
                    // Fallback to VSM production_group_lines SalesPrice
                    let mut pg_price = None;
                    if let Ok(mut vsm_client) = get_connection_vsm() {
                        if let Ok(row) = vsm_client.query_one(
                            "SELECT \"SalesPrice\" FROM production_group_lines WHERE \"ProductionGroup\" = $1 LIMIT 1",
                            &[&project.production_group]
                        ) {
                            let price: Option<f64> = row.get(0);
                            pg_price = price;
                        }
                    }
                    sales_price = pg_price;
                }
            }
        }
    }

    let final_sales_price = sales_price.unwrap_or(0.0);

    // Resolve project ID (use existing one if found to prevent duplicate projects when downloading again)
    let project_id = existing_project_id.clone().unwrap_or_else(|| project.project_id.clone());

    let was_already_completed = existing_status.as_deref() == Some("completed");
    if project.status == "completed" && !was_already_completed && !latest_session_is_fully_verified(&mut client, &project_id) {
        return Err("Cannot complete project: the latest inspection session has not been digitally signed by both the factory representative and the HO approver.".to_string());
    }

    // 2. Insert/upsert the project row first so foreign key constraints on details/lines succeed
    let has_deduction_val = project.has_deduction.unwrap_or(false);
    let deduction_amount_val = project.deduction_amount.unwrap_or(0.0);
    client.execute(
        "INSERT INTO packaging_projects (project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, sales_price, has_deduction, deduction_amount, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
         ON CONFLICT (project_id)
         DO UPDATE SET plm_id = $2, brand = $3, season = $4, article_name = $5, production_group = $6, po_info = $7, po_qty = $8, po_plan_date = $9, po_vendor = $10, status = $11, cmt_cut_job_id = $12, cmt_pak_job_id = $13, sales_price = $14, has_deduction = $15, deduction_amount = $16, updated_at = NOW()",
        &[
            &project_id,
            &project.plm_id,
            &project.brand,
            &project.season,
            &project.article_name,
            &project.production_group,
            &project.po_info,
            &project.po_qty,
            &project.po_plan_date,
            &project.po_vendor,
            &project.status,
            &final_cut_job,
            &final_pak_job,
            &final_sales_price,
            &has_deduction_val,
            &deduction_amount_val,
        ],
    ).map_err(|e| format!("Failed to save packaging project: {}", e))?;

    // Adopt any portal-staged fabric lines (project_id=NULL) published before the project existed
    let _ = client.execute(
        "UPDATE packaging_project_fabric_lines SET project_id = $1 WHERE production_group = $2 AND project_id IS NULL",
        &[&project_id, &project.production_group],
    );

    // 3. Seed detail lines (if not already present)
    let initial_pak_count: i64 = client.query_one(
        "SELECT COUNT(*) FROM packaging_project_reports WHERE project_id = $1 AND session_id = 'INITIAL_PAK'",
        &[&project_id]
    ).map(|r| r.get(0)).unwrap_or(0);

    if initial_pak_count == 0 {
        let mut seeded_from_erp = false;
        // Fetch and seed CMT-Cut lines
        if let Some(ref cut_id) = final_cut_job {
            if fetch_and_store_lines(&creds, &token, &mut client, &project_id, cut_id, None).is_ok() {
                seeded_from_erp = true;
            }
        }
        // Fetch and seed CMT-Pak lines
        if let Some(ref pak_id) = final_pak_job {
            if fetch_and_store_lines(&creds, &token, &mut client, &project_id, pak_id, Some("INITIAL_PAK")).is_ok() {
                seeded_from_erp = true;
            }
        }

        // Fallback: Copy baseline reports from previous project records if ERP seeding failed or returned nothing
        let mut seeded_from_prev = false;
        if !seeded_from_erp {
            if let Some(ref prev_pid) = existing_project_id {
                let rows = client.query(
                    "SELECT data_area_id, line_no, job_transaction_id, item_id, size_val, global_display_order,
                            reject_produksi, reject_finishing, reject_embro, qty_order, total_qty_sample, barang_hilang,
                            reject_cutting, total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                            reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, session_id
                     FROM packaging_project_reports
                     WHERE project_id = $1 AND (session_id IS NULL OR session_id = 'INITIAL_PAK')",
                    &[prev_pid]
                ).unwrap_or_default();

                if !rows.is_empty() {
                    for (idx, r_row) in rows.iter().enumerate() {
                        let data_area_id: Option<String> = r_row.get(0);
                        let line_no: Option<i32> = r_row.get(1);
                        let job_transaction_id: Option<String> = r_row.get(2);
                        let item_id: Option<String> = r_row.get(3);
                        let size_val: Option<String> = r_row.get(4);
                        let global_display_order: Option<i32> = r_row.get(5);
                        let reject_produksi: Option<i32> = r_row.get(6);
                        let reject_finishing: Option<i32> = r_row.get(7);
                        let reject_embro: Option<i32> = r_row.get(8);
                        let qty_order: Option<i32> = r_row.get(9);
                        let total_qty_sample: Option<i32> = r_row.get(10);
                        let barang_hilang: Option<i32> = r_row.get(11);
                        let reject_cutting: Option<i32> = r_row.get(12);
                        let total_reject_qty: Option<i32> = r_row.get(13);
                        let reject_printing: Option<i32> = r_row.get(14);
                        let ref_rec_id: Option<i64> = r_row.get(15);
                        let total_good_qty: Option<i32> = r_row.get(16);
                        let reject_sewing: Option<i32> = r_row.get(17);
                        let reject_washing: Option<i32> = r_row.get(18);
                        let gramasi: Option<f64> = r_row.get(19);
                        let btj: Option<i32> = r_row.get(20);
                        let reject_bahan: Option<i32> = r_row.get(21);
                        let session_qty: f64 = r_row.get(22);
                        let session_version: Option<String> = r_row.get(23);
                        let session_id: Option<String> = r_row.get(24);

                        let new_report_id = format!("{}_{}_{}", project_id, job_transaction_id.as_deref().unwrap_or("job"), idx);

                        let _ = client.execute(
                            "INSERT INTO packaging_project_reports (
                                report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                                reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                             )
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())",
                            &[
                                &new_report_id,
                                &session_id,
                                &project_id,
                                &data_area_id,
                                &line_no,
                                &job_transaction_id,
                                &item_id,
                                &size_val,
                                &global_display_order,
                                &reject_produksi,
                                &reject_finishing,
                                &reject_embro,
                                &qty_order,
                                &total_qty_sample,
                                &barang_hilang,
                                &reject_cutting,
                                &total_reject_qty,
                                &reject_printing,
                                &ref_rec_id,
                                &total_good_qty,
                                &reject_sewing,
                                &reject_washing,
                                &gramasi,
                                &btj,
                                &reject_bahan,
                                &session_qty,
                                &session_version,
                            ]
                        );
                    }
                    seeded_from_prev = true;
                }
            }
        }

        // Fallback: Seed directly from production_group_lines in VSM if both ERP seeding and previous copy failed
        if !seeded_from_erp && !seeded_from_prev {
            if let Err(e) = seed_reports_from_production_group_lines(&mut client, &project_id, &project.production_group, &project.plm_id) {
                println!("Warning: Fallback seeding from VSM failed: {}", e);
            }
        }
    }

    // Seed Session 0 and Session 1 only for new projects — existing projects already have these seeded
    if existing_project_id.is_none() {
    // 1. Calculate aggregated values from OData details stored in packaging_project_reports
    let mut total_order_qty = project.po_qty.unwrap_or(0.0) as i32;
    
    // Query CMT-Cut lines (session_id IS NULL) to resolve total_order_qty
    if let Ok(rows) = client.query(
        "SELECT COALESCE(SUM(qty_order), 0)::int4
         FROM packaging_project_reports 
         WHERE project_id = $1 AND session_id IS NULL",
        &[&project_id]
    ) {
        if let Some(row) = rows.first() {
            let order_sum: i32 = row.get(0);
            if order_sum > 0 {
                total_order_qty = order_sum;
            }
        }
    }
    
    let cutting_pcs = 0;
    let packing_pcs = 0;
    let sewing_pcs = 0;
    let finishing_pcs = 0;

    // 2. UPSERT Session 0 (Baseline)
    let session_0_id = format!("BASE-{}", project_id);
    client.execute(
        "INSERT INTO packaging_project_sessions (
            session_id, project_id, cycle_number, inspector_id, status, started_at, ended_at,
            inspection_date, check_wash, check_style_as_sample, check_main_label, check_flag_fit_label,
            check_print_embro_artwork, check_hangtag, check_waist_tag, check_barcode, check_packing_list,
            check_shipping_mark, qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs,
            finishing_pcs, packing_pcs, sampling_pcs, aql, level_val, factory_representative, inspector,
            version, result
         )
         VALUES ($1, $2, 0, 'system', 'completed', NOW(), NOW(), CURRENT_DATE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, $3, $3, $3, $4, $5, $6, $7, 0, 2.5, 1.0, 'System Baseline', 'System (CMT-Cut)', 'Baseline', 'Passed')
         ON CONFLICT (session_id) DO UPDATE SET
            qty_available = $3, total_store = $3, store_inspected = $3, cutting_pcs = $4, sewing_pcs = $5, finishing_pcs = $6, packing_pcs = $7",
        &[
            &session_0_id,
            &project_id,
            &total_order_qty,
            &cutting_pcs,
            &sewing_pcs,
            &finishing_pcs,
            &packing_pcs
        ]
    ).map_err(|e| format!("Failed to seed Session 0: {}", e))?;

    // 3. UPSERT Session 1 (Pre Final)
    let session_1_id = format!("SES-{}-1", project_id);
    client.execute(
        "INSERT INTO packaging_project_sessions (
            session_id, project_id, cycle_number, inspector_id, status, started_at, ended_at,
            inspection_date, check_wash, check_style_as_sample, check_main_label, check_flag_fit_label,
            check_print_embro_artwork, check_hangtag, check_waist_tag, check_barcode, check_packing_list,
            check_shipping_mark, qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs,
            finishing_pcs, packing_pcs, sampling_pcs, aql, level_val, factory_representative, inspector,
            version, result
         )
         VALUES ($1, $2, 1, 'inspector-1', 'pending', NOW(), NULL, CURRENT_DATE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, $3, 0, 0, $4, $5, $6, $7, 0, 2.5, 1.0, NULL, NULL, 'v1.0', 'Pending')
         ON CONFLICT (session_id) DO NOTHING",
        &[
            &session_1_id,
            &project_id,
            &total_order_qty,
            &cutting_pcs,
            &sewing_pcs,
            &finishing_pcs,
            &packing_pcs
        ]
    ).map_err(|e| format!("Failed to seed Session 1: {}", e))?;

    // 4. Duplicate INITIAL_PAK lines into Session 1 report lines if they don't exist
    let existing_lines_count: i64 = client.query_one(
        "SELECT COUNT(*) FROM packaging_project_reports WHERE project_id = $1 AND session_id = $2",
        &[&project_id, &session_1_id]
    ).map(|r| r.get(0)).unwrap_or(0);
    
    if existing_lines_count == 0 {
        client.execute(
            "INSERT INTO packaging_project_reports (
                report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
             )
             SELECT 
                $1 || '_LINE_' || (row_number() OVER (ORDER BY line_no ASC, global_display_order ASC))::text, 
                $1, 
                project_id, data_area_id, line_no, job_transaction_id,
                item_id, size_val, global_display_order, 0, 0,
                0, qty_order, total_qty_sample, 0, 0,
                total_reject_qty, 0, ref_rec_id, total_good_qty, 0,
                0, gramasi, 0, 0, 0.0, 'v1.0', NOW()
             FROM packaging_project_reports
             WHERE project_id = $2 AND session_id = 'INITIAL_PAK'",
            &[&session_1_id, &project_id]
        ).map_err(|e| format!("Failed to duplicate INITIAL_PAK lines to Session 1: {}", e))?;
    }

    } // end: new project seeding block

    // RPA queueing moved to the portal's approval chain (Director workflow):
    // job_trans_raf is queued when MD Production approves, invoice/deduction
    // when the Director approves — the portal also marks the project completed.
    // The console no longer queues OR deletes those jobs on save, so a re-save
    // can never wipe portal-queued work. (Manual partial RAF sync remains via
    // trigger_partial_process_sync.)

    Ok(project_id)
}

pub fn trigger_partial_process_sync(project_id: &str) -> Result<String, String> {
    queue_job_trans_raf_internal(project_id)?;
    Ok(project_id.to_string())
}

pub fn queue_job_trans_raf_internal(project_id: &str) -> Result<(), String> {
    let mut client = get_connection_qms()?;
    let row = client.query_one(
        "SELECT production_group, cmt_pak_job_id, po_info FROM packaging_projects WHERE project_id = $1",
        &[&project_id]
    ).map_err(|e| format!("Failed to retrieve project details: {}", e))?;

    let production_group: String = row.get(0);
    let cmt_pak_job_id: Option<String> = row.get(1);
    let po_info: Option<String> = row.get(2);

    // Retrieve all unique sizes for this project in correct database display sequence
    let size_rows = client.query(
        "SELECT size_val, line_no, global_display_order 
         FROM packaging_project_reports 
         WHERE project_id = $1 
         ORDER BY line_no ASC, global_display_order ASC",
        &[&project_id]
    ).unwrap_or_default();
    let mut ordered_sizes = Vec::new();
    for s_row in size_rows {
        if let Some(sz) = s_row.get::<_, Option<String>>(0) {
            let sz_trimmed = sz.trim().to_string();
            if !sz_trimmed.is_empty() && !ordered_sizes.contains(&sz_trimmed) {
                ordered_sizes.push(sz_trimmed);
            }
        }
    }

    // Retrieve all inspection sessions for this project (excluding cycle 0 baseline)
    let session_rows = client.query(
        "SELECT session_id, cycle_number, inspection_date, result, version 
         FROM packaging_project_sessions 
         WHERE project_id = $1 AND cycle_number >= 1 
         ORDER BY cycle_number ASC",
        &[&project_id]
    ).map_err(|e| format!("Failed to query sessions for RPA job details: {}", e))?;

    struct SessionData {
        cycle_number: i32,
        inspection_date: Option<chrono::NaiveDate>,
        lines: Vec<(String, f64, i32, i32, i32, i32, i32, i32, i32, i32, i32, i32)>,
    }

    let mut sessions_list = Vec::new();
    for s_row in session_rows {
        let session_id: String = s_row.get(0);
        let cycle_number: i32 = s_row.get(1);
        let inspection_date: Option<chrono::NaiveDate> = s_row.get(2);

        let line_rows = client.query(
            "SELECT size_val, session_qty,
                    COALESCE(reject_produksi, 0),
                    COALESCE(reject_finishing, 0),
                    COALESCE(reject_embro, 0),
                    COALESCE(barang_hilang, 0),
                    COALESCE(reject_cutting, 0),
                    COALESCE(reject_printing, 0),
                    COALESCE(reject_sewing, 0),
                    COALESCE(reject_washing, 0),
                    COALESCE(btj, 0),
                    COALESCE(reject_bahan, 0)
             FROM packaging_project_reports
             WHERE project_id = $1 AND session_id = $2",
            &[&project_id, &session_id]
        ).map_err(|e| format!("Failed to query report lines for RPA session details: {}", e))?;

        let mut lines = Vec::new();
        for l_row in line_rows {
            let size_val: Option<String> = l_row.get(0);
            let session_qty: f64 = l_row.get(1);
            let reject_produksi: i32 = l_row.get(2);
            let reject_finishing: i32 = l_row.get(3);
            let reject_embro: i32 = l_row.get(4);
            let barang_hilang: i32 = l_row.get(5);
            let reject_cutting: i32 = l_row.get(6);
            let reject_printing: i32 = l_row.get(7);
            let reject_sewing: i32 = l_row.get(8);
            let reject_washing: i32 = l_row.get(9);
            let btj: i32 = l_row.get(10);
            let reject_bahan: i32 = l_row.get(11);

            if let Some(sz) = size_val {
                lines.push((
                    sz.trim().to_string(),
                    session_qty,
                    reject_produksi,
                    reject_finishing,
                    reject_embro,
                    barang_hilang,
                    reject_cutting,
                    reject_printing,
                    reject_sewing,
                    reject_washing,
                    btj,
                    reject_bahan,
                ));
            }
        }

        sessions_list.push(SessionData {
            cycle_number,
            inspection_date,
            lines,
        });
    }

    // Define session groups mapping
    struct GroupDef {
        label: String,
        cycles: Vec<i32>,
    }

    let mut group_defs = vec![
        GroupDef {
            label: "final_1".to_string(),
            cycles: vec![1, 2],
        },
        GroupDef {
            label: "final_2".to_string(),
            cycles: vec![3],
        },
        GroupDef {
            label: "final_3".to_string(),
            cycles: vec![4],
        },
    ];

    let mut max_cycle = 4;
    for sess in &sessions_list {
        if sess.cycle_number > max_cycle {
            max_cycle = sess.cycle_number;
        }
    }
    for c in 5..=max_cycle {
        group_defs.push(GroupDef {
            label: format!("final_{}", c - 1),
            cycles: vec![c],
        });
    }

    let mut sessions_payload = Vec::new();
    for gdef in group_defs {
        let group_sessions: Vec<&SessionData> = sessions_list.iter()
            .filter(|s| gdef.cycles.contains(&s.cycle_number))
            .collect();

        if group_sessions.is_empty() {
            continue;
        }

        let mut inspection_date = None;
        for gs in &group_sessions {
            if let Some(d) = gs.inspection_date {
                inspection_date = Some(d.format("%Y-%m-%d").to_string());
            }
        }

        // Aggregate good_qty, reject_qty (total rejects), and each individual reject type per size
        let mut size_map = std::collections::HashMap::new();
        for gs in &group_sessions {
            for (sz, good, rej_prod, rej_fin, rej_emb, bar_hil, rej_cut, rej_prt, rej_sew, rej_was, btj_val, rej_bah) in &gs.lines {
                let entry = size_map.entry(sz.clone()).or_insert((
                    0.0, // good_qty
                    0,   // reject_qty
                    0,   // reject_produksi
                    0,   // reject_finishing
                    0,   // reject_embro
                    0,   // barang_hilang
                    0,   // reject_cutting
                    0,   // reject_printing
                    0,   // reject_sewing
                    0,   // reject_washing
                    0,   // btj
                    0,   // reject_bahan
                ));
                entry.0 += good;
                let total_rej = rej_bah + rej_cut + rej_sew + rej_fin + rej_prt + rej_emb + rej_was + btj_val + bar_hil;
                entry.1 += total_rej;
                entry.2 += rej_prod;
                entry.3 += rej_fin;
                entry.4 += rej_emb;
                entry.5 += bar_hil;
                entry.6 += rej_cut;
                entry.7 += rej_prt;
                entry.8 += rej_sew;
                entry.9 += rej_was;
                entry.10 += btj_val;
                entry.11 += rej_bah;
            }
        }

        let mut sizes_json = Vec::new();
        for sz in &ordered_sizes {
            if let Some(metrics) = size_map.get(sz) {
                sizes_json.push(serde_json::json!({
                    "size": sz,
                    "good_qty": metrics.0,
                    "reject_qty": metrics.1,
                    "reject_produksi": metrics.2,
                    "reject_finishing": metrics.3,
                    "reject_embro": metrics.4,
                    "barang_hilang": metrics.5,
                    "reject_cutting": metrics.6,
                    "reject_printing": metrics.7,
                    "reject_sewing": metrics.8,
                    "reject_washing": metrics.9,
                    "btj": metrics.10,
                    "reject_bahan": metrics.11,
                }));
            }
        }

        sessions_payload.push(serde_json::json!({
            "version_label": gdef.label,
            "inspection_date": inspection_date.unwrap_or_default(),
            "sizes": sizes_json,
        }));
    }

    let job_trans_raf_payload = serde_json::json!({
        "project_id": project_id.to_string(),
        "production_group": production_group,
        "job_transaction_id": cmt_pak_job_id.unwrap_or_default(),
        "po_info": po_info.unwrap_or_default(),
        "sessions": sessions_payload,
    });

    let mut rpa_client = get_connection_rpa()?;
    let job_trans_exists: bool = rpa_client.query_one(
        "SELECT EXISTS(SELECT 1 FROM rpa_queues WHERE entity_id = $1 AND rpa_type = 'job_trans_raf' AND status IN ('pending', 'processing'))",
        &[&project_id]
    ).map(|r| r.get(0)).unwrap_or(false);

    if job_trans_exists {
        rpa_client.execute(
            "UPDATE rpa_queues SET payload = $2, updated_at = NOW() WHERE entity_id = $1 AND rpa_type = 'job_trans_raf' AND status = 'pending'",
            &[&project_id, &job_trans_raf_payload]
        ).map_err(|e| format!("Failed to update job_trans_raf RPA job payload: {}", e))?;
    } else {
        rpa_client.execute(
            "INSERT INTO rpa_queues (entity_type, entity_id, rpa_type, status, payload)
             VALUES ('packaging_project', $1, 'job_trans_raf', 'pending', $2)",
            &[&project_id, &job_trans_raf_payload]
        ).map_err(|e| format!("Failed to queue job_trans_raf RPA job: {}", e))?;
    }

    Ok(())
}


/// Returns the new `row_version` on success.
/// Returns `Err("CONFLICT")` when another writer has incremented the row since the client last read it.
pub fn save_packaging_session(session: PackagingProjectSession) -> Result<i32, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    
    let parsed_started = NaiveDateTime::parse_from_str(&session.started_at, "%Y-%m-%dT%H:%M:%S%.3fZ")
        .or_else(|_| NaiveDateTime::parse_from_str(&session.started_at, "%Y-%m-%dT%H:%M:%SZ"))
        .or_else(|_| NaiveDateTime::parse_from_str(&session.started_at, "%Y-%m-%d %H:%M:%S"))
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc());

    let parsed_ended = session.ended_at.as_ref().and_then(|t| {
        NaiveDateTime::parse_from_str(t, "%Y-%m-%dT%H:%M:%S%.3fZ")
            .or_else(|_| NaiveDateTime::parse_from_str(t, "%Y-%m-%dT%H:%M:%SZ"))
            .or_else(|_| NaiveDateTime::parse_from_str(t, "%Y-%m-%d %H:%M:%S"))
            .ok()
    });

    let expected_version = session.row_version.unwrap_or(0);

    let rows_affected = client.execute(
        "INSERT INTO packaging_project_sessions (
            session_id, project_id, cycle_number, inspector_id, status, started_at, ended_at,
            inspection_date, check_wash, check_style_as_sample, check_main_label, check_flag_fit_label,
            check_print_embro_artwork, check_hangtag, check_waist_tag, check_barcode, check_packing_list,
            check_shipping_mark, check_other_1, check_other_1_label, check_other_2, check_other_2_label,
            qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs,
            finishing_pcs, packing_pcs, sampling_pcs, aql, level_val, factory_representative, inspector,
            version, result, row_version
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 = '' THEN NULL ELSE $8::DATE END, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, 1)
         ON CONFLICT (session_id)
         DO UPDATE SET
            cycle_number = $3, inspector_id = $4, status = $5, started_at = $6, ended_at = $7,
            inspection_date = CASE WHEN $8 = '' THEN NULL ELSE $8::DATE END, check_wash = $9, check_style_as_sample = $10,
            check_main_label = $11, check_flag_fit_label = $12, check_print_embro_artwork = $13, check_hangtag = $14,
            check_waist_tag = $15, check_barcode = $16, check_packing_list = $17, check_shipping_mark = $18,
            check_other_1 = $19, check_other_1_label = $20, check_other_2 = $21, check_other_2_label = $22,
            qty_available = $23, total_store = $24, store_inspected = $25, cutting_pcs = $26, sewing_pcs = $27,
            finishing_pcs = $28, packing_pcs = $29, sampling_pcs = $30, aql = $31, level_val = $32,
            factory_representative = $33, inspector = $34, version = $35, result = $36,
            row_version = packaging_project_sessions.row_version + 1
         WHERE ($37 = 0 OR packaging_project_sessions.row_version = $37)",
        &[
            &session.session_id,
            &session.project_id,
            &session.cycle_number,
            &session.inspector_id,
            &session.status,
            &parsed_started,
            &parsed_ended,
            &session.inspection_date.unwrap_or_default(),
            &session.check_wash,
            &session.check_style_as_sample,
            &session.check_main_label,
            &session.check_flag_fit_label,
            &session.check_print_embro_artwork,
            &session.check_hangtag,
            &session.check_waist_tag,
            &session.check_barcode,
            &session.check_packing_list,
            &session.check_shipping_mark,
            &session.check_other_1,
            &session.check_other_1_label,
            &session.check_other_2,
            &session.check_other_2_label,
            &session.qty_available,
            &session.total_store,
            &session.store_inspected,
            &session.cutting_pcs,
            &session.sewing_pcs,
            &session.finishing_pcs,
            &session.packing_pcs,
            &session.sampling_pcs,
            &session.aql,
            &session.level_val,
            &session.factory_representative,
            &session.inspector,
            &session.version,
            &session.result,
            &expected_version,
        ],
    ).map_err(|e| format!("Failed to save packaging session: {}", e))?;

    if rows_affected == 0 {
        return Err("CONFLICT".to_string());
    }
    // New sessions start at 1; existing sessions were incremented by the DO UPDATE
    let new_version = if expected_version == 0 { 1 } else { expected_version + 1 };
    Ok(new_version)
}

pub fn save_packaging_defect_image(image: PackagingDefectImage) -> Result<(), String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    let parsed_captured = NaiveDateTime::parse_from_str(&image.captured_at, "%Y-%m-%dT%H:%M:%S%.3fZ")
        .or_else(|_| NaiveDateTime::parse_from_str(&image.captured_at, "%Y-%m-%dT%H:%M:%SZ"))
        .or_else(|_| NaiveDateTime::parse_from_str(&image.captured_at, "%Y-%m-%d %H:%M:%S"))
        .unwrap_or_else(|_| chrono::Utc::now().naive_utc());

    client.execute(
        "INSERT INTO packaging_defect_images (image_id, project_id, session_id, image_path, defect_type, description, major, minor, captured_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (image_id)
         DO UPDATE SET session_id = $3, image_path = $4, defect_type = $5, description = $6, major = $7, minor = $8, captured_at = $9",
        &[
            &image.image_id,
            &image.project_id,
            &image.session_id,
            &image.image_path,
            &image.defect_type,
            &image.description,
            &image.major,
            &image.minor,
            &parsed_captured,
        ],
    ).map_err(|e| format!("Failed to save packaging defect image: {}", e))?;
    Ok(())
}

pub fn delete_packaging_defect_image(image_id: &str) -> Result<(), String> {
    let mut client = get_connection_qms()?;
    client.execute(
        "DELETE FROM packaging_defect_images WHERE image_id = $1",
        &[&image_id],
    ).map_err(|e| format!("Failed to delete packaging defect image: {}", e))?;
    Ok(())
}

pub fn get_packaging_projects() -> Result<Value, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    
    let rows = client.query("SELECT project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, sales_price, verified_doc, has_deduction, deduction_amount, created_at, updated_at FROM packaging_projects WHERE status NOT IN ('removed', 'removed_completed') ORDER BY created_at DESC", &[])
        .map_err(|e| format!("Failed to query packaging projects: {}", e))?;
        
    let mut projects = Vec::new();
    for row in rows {
        let project_id: String = row.get(0);
        let plm_id: String = row.get(1);
        let brand: String = row.get(2);
        let season: String = row.get(3);
        let article_name: String = row.get(4);
        let production_group: String = row.get(5);
        let po_info: Option<String> = row.get(6);
        let po_qty: Option<f64> = row.get(7);
        let po_plan_date: Option<String> = row.get(8);
        let po_vendor: Option<String> = row.get(9);
        let status: String = row.get(10);
        let cmt_cut_job_id: Option<String> = row.get(11);
        let cmt_pak_job_id: Option<String> = row.get(12);
        let sales_price: Option<f64> = row.get(13);
        let verified_doc: Option<String> = row.get(14);
        let has_deduction: bool = row.get(15);
        let deduction_amount: f64 = row.get(16);
        let created_at: NaiveDateTime = row.get(17);
        let updated_at: NaiveDateTime = row.get(18);

        let base_report = serde_json::Value::Null;

        // Fetch base lines (CMT-Cut OData rows) using the existing client connection
        let base_lines_json = match get_packaging_project_reports_impl(&mut client, &project_id, None) {
            Ok(lines) => lines,
            Err(_) => serde_json::Value::Array(vec![]),
        };

        // 2. Fetch sessions for this project
        let session_rows = client.query(
            "SELECT session_id, cycle_number, inspector_id, status, started_at, ended_at, inspection_date,
                    check_wash, check_style_as_sample, check_main_label, check_flag_fit_label, check_print_embro_artwork,
                    check_hangtag, check_waist_tag, check_barcode, check_packing_list, check_shipping_mark,
                    check_other_1, check_other_1_label, check_other_2, check_other_2_label,
                    qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs, finishing_pcs, packing_pcs, sampling_pcs,
                    aql, level_val, factory_representative, inspector, version, result,
                    approval_status, approved_by, approved_at::text, approval_source, approval_token::text, approval_email, approval_signature, ho_approval_signature,
                    director_approval_signature, inspector_email
             FROM packaging_project_sessions 
             WHERE project_id = $1 
             ORDER BY cycle_number ASC",
            &[&project_id]
        ).map_err(|e| format!("Failed to query sessions for {}: {}", project_id, e))?;

        // Batch-fetch all deduction lines for this project's sessions in one query
        let session_ids_batch: Vec<String> = session_rows.iter().map(|r| r.get::<_, String>(0)).collect();
        let mut all_deduction_map: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();
        if !session_ids_batch.is_empty() {
            if let Ok(dl_batch) = client.query(
                "SELECT session_id, id::text, description, amount, created_by, created_at::text FROM packaging_session_deduction_lines WHERE session_id = ANY($1) ORDER BY created_at ASC",
                &[&session_ids_batch],
            ) {
                for r in dl_batch {
                    let sid: String = r.get(0);
                    all_deduction_map.entry(sid).or_default().push(serde_json::json!({
                        "id": r.get::<_, Option<String>>(1),
                        "description": r.get::<_, String>(2),
                        "amount": r.get::<_, f64>(3),
                        "created_by": r.get::<_, Option<String>>(4),
                        "created_at": r.get::<_, Option<String>>(5),
                    }));
                }
            }
        }

        let mut sessions = Vec::new();
        for s_row in &session_rows {
            let session_id: String = s_row.get(0);
            let s_started: NaiveDateTime = s_row.get(4);
            let s_ended: Option<NaiveDateTime> = s_row.get(5);
            let s_inspect_date: Option<chrono::NaiveDate> = s_row.get(6);

            // Fetch session report lines (CMT-Pak lines for this session) using the existing client connection
            let mut session_lines_json = match get_packaging_project_reports_impl(&mut client, &project_id, Some(&session_id)) {
                Ok(lines) => lines,
                Err(_) => serde_json::Value::Array(vec![]),
            };

            // Auto-recovery safety fallback: if session has 0 lines, populate it by duplicating INITIAL_PAK lines
            if let Some(arr) = session_lines_json.as_array() {
                if arr.is_empty() {
                    let _ = client.execute(
                        "INSERT INTO packaging_project_reports (
                            report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                            item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                            reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                            total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                            reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                         )
                         SELECT 
                            $1 || '_LINE_' || (row_number() OVER (ORDER BY line_no ASC, global_display_order ASC))::text, 
                            $1, 
                            project_id, data_area_id, line_no, job_transaction_id,
                            item_id, size_val, global_display_order, 0, 0,
                            0, qty_order, total_qty_sample, 0, 0,
                            total_reject_qty, 0, ref_rec_id, total_good_qty, 0,
                            0, gramasi, 0, 0, 0.0, 'v1.0', NOW()
                         FROM packaging_project_reports
                         WHERE project_id = $2 AND session_id = 'INITIAL_PAK'",
                        &[&session_id, &project_id]
                    );

                    // Re-query the report lines after duplication using the existing client connection
                    if let Ok(lines) = get_packaging_project_reports_impl(&mut client, &project_id, Some(&session_id)) {
                        session_lines_json = lines;
                    }
                }
            }

            let deduction_lines_json = serde_json::Value::Array(
                all_deduction_map.get(&session_id).cloned().unwrap_or_default()
            );

            sessions.push(serde_json::json!({
                "session_id": session_id,
                "project_id": project_id,
                "cycle_number": s_row.get::<_, i32>(1),
                "inspector_id": s_row.get::<_, String>(2),
                "status": s_row.get::<_, String>(3),
                "started_at": s_started.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
                "ended_at": s_ended.map(|t| t.format("%Y-%m-%dT%H:%M:%S.000Z").to_string()),
                "inspection_date": s_inspect_date.map(|d| d.format("%Y-%m-%d").to_string()),
                "check_wash": s_row.get::<_, bool>(7),
                "check_style_as_sample": s_row.get::<_, bool>(8),
                "check_main_label": s_row.get::<_, bool>(9),
                "check_flag_fit_label": s_row.get::<_, bool>(10),
                "check_print_embro_artwork": s_row.get::<_, bool>(11),
                "check_hangtag": s_row.get::<_, bool>(12),
                "check_waist_tag": s_row.get::<_, bool>(13),
                "check_barcode": s_row.get::<_, bool>(14),
                "check_packing_list": s_row.get::<_, bool>(15),
                "check_shipping_mark": s_row.get::<_, bool>(16),
                "check_other_1": s_row.get::<_, bool>(17),
                "check_other_1_label": s_row.get::<_, Option<String>>(18),
                "check_other_2": s_row.get::<_, bool>(19),
                "check_other_2_label": s_row.get::<_, Option<String>>(20),
                "qty_available": s_row.get::<_, i32>(21),
                "total_store": s_row.get::<_, i32>(22),
                "store_inspected": s_row.get::<_, i32>(23),
                "cutting_pcs": s_row.get::<_, i32>(24),
                "sewing_pcs": s_row.get::<_, i32>(25),
                "finishing_pcs": s_row.get::<_, i32>(26),
                "packing_pcs": s_row.get::<_, i32>(27),
                "sampling_pcs": s_row.get::<_, i32>(28),
                "aql": s_row.get::<_, f64>(29),
                "level_val": s_row.get::<_, f64>(30),
                "factory_representative": s_row.get::<_, Option<String>>(31),
                "inspector": s_row.get::<_, Option<String>>(32),
                "version": s_row.get::<_, Option<String>>(33),
                "result": s_row.get::<_, Option<String>>(34),
                "approval_status": s_row.get::<_, Option<String>>(35),
                "approved_by": s_row.get::<_, Option<String>>(36),
                "approved_at": s_row.get::<_, Option<String>>(37),
                "approval_source": s_row.get::<_, Option<String>>(38),
                "approval_token": s_row.get::<_, Option<String>>(39),
                "approval_email": s_row.get::<_, Option<String>>(40),
                "approval_signature": s_row.get::<_, Option<String>>(41),
                "ho_approval_signature": s_row.get::<_, Option<String>>(42),
                "director_approval_signature": s_row.get::<_, Option<String>>(43),
                "inspector_email": s_row.get::<_, Option<String>>(44),
                "report_lines": session_lines_json,
                "deduction_lines": deduction_lines_json
            }));
        }

        // 3. Fetch defect images for this project
        let image_rows = client.query(
            "SELECT image_id, session_id, image_path, defect_type, description, major, minor, captured_at 
             FROM packaging_defect_images 
             WHERE project_id = $1 
             ORDER BY captured_at DESC",
            &[&project_id]
        ).map_err(|e| format!("Failed to query images for {}: {}", project_id, e))?;

        let mut defect_images = Vec::new();
        for img_row in image_rows {
            let img_captured: NaiveDateTime = img_row.get(7);
            defect_images.push(serde_json::json!({
                "image_id": img_row.get::<_, String>(0),
                "project_id": project_id,
                "session_id": img_row.get::<_, Option<String>>(1),
                "image_path": img_row.get::<_, String>(2),
                "defect_type": img_row.get::<_, String>(3),
                "description": img_row.get::<_, Option<String>>(4),
                "major": img_row.get::<_, i32>(5),
                "minor": img_row.get::<_, i32>(6),
                "captured_at": img_captured.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            }));
        }

        let fabric_lines_json: serde_json::Value = match client.query(
            "SELECT id::text, label, fabric_sent, consumption_plan, cutt_plan, actual_consumption, short_roll, sisa_kain, kepala_kain, return_kain, created_by, created_at::text, production_group, overconsumption, fabric_price, deduction FROM packaging_project_fabric_lines WHERE project_id = $1 ORDER BY created_at ASC",
            &[&project_id],
        ) {
            Ok(fl_rows) => serde_json::Value::Array(fl_rows.iter().map(|r| serde_json::json!({
                "id": r.get::<_, Option<String>>(0),
                "label": r.get::<_, Option<String>>(1),
                "fabric_sent": r.get::<_, f64>(2),
                "consumption_plan": r.get::<_, f64>(3),
                "cutt_plan": r.get::<_, f64>(4),
                "actual_consumption": r.get::<_, f64>(5),
                "short_roll": r.get::<_, f64>(6),
                "sisa_kain": r.get::<_, f64>(7),
                "kepala_kain": r.get::<_, f64>(8),
                "return_kain": r.get::<_, f64>(9),
                "created_by": r.get::<_, Option<String>>(10),
                "created_at": r.get::<_, Option<String>>(11),
                "production_group": r.get::<_, Option<String>>(12),
                "overconsumption": r.get::<_, Option<f64>>(13),
                "fabric_price": r.get::<_, Option<f64>>(14),
                "deduction": r.get::<_, Option<f64>>(15),
            })).collect()),
            Err(_) => serde_json::Value::Array(vec![]),
        };

        projects.push(serde_json::json!({
            "project_id": project_id,
            "plm_id": plm_id,
            "brand": brand,
            "season": season,
            "article_name": article_name,
            "production_group": production_group,
            "po_info": po_info,
            "po_qty": po_qty,
            "po_plan_date": po_plan_date,
            "po_vendor": po_vendor,
            "status": status,
            "cmt_cut_job_id": cmt_cut_job_id,
            "cmt_pak_job_id": cmt_pak_job_id,
            "sales_price": sales_price,
            "verified_doc": verified_doc,
            "has_deduction": has_deduction,
            "deduction_amount": deduction_amount,
            "created_at": created_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "updated_at": updated_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "base_report": base_report,
            "base_lines": base_lines_json,
            "sessions": sessions,
            "defect_images": defect_images,
            "fabric_lines": fabric_lines_json
        }));
    }

    Ok(serde_json::Value::Array(projects))
}

pub fn get_packaging_projects_summary() -> Result<Value, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    
    let rows = client.query("SELECT project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, sales_price, verified_doc, has_deduction, deduction_amount, created_at, updated_at FROM packaging_projects WHERE status NOT IN ('removed', 'removed_completed') ORDER BY created_at DESC", &[])
        .map_err(|e| format!("Failed to query packaging projects summary: {}", e))?;

    let mut projects = Vec::new();
    for row in rows {
        let project_id: String = row.get(0);
        let plm_id: String = row.get(1);
        let brand: String = row.get(2);
        let season: String = row.get(3);
        let article_name: String = row.get(4);
        let production_group: String = row.get(5);
        let po_info: Option<String> = row.get(6);
        let po_qty: Option<f64> = row.get(7);
        let po_plan_date: Option<String> = row.get(8);
        let po_vendor: Option<String> = row.get(9);
        let status: String = row.get(10);
        let cmt_cut_job_id: Option<String> = row.get(11);
        let cmt_pak_job_id: Option<String> = row.get(12);
        let sales_price: Option<f64> = row.get(13);
        let verified_doc: Option<String> = row.get(14);
        let has_deduction: bool = row.get(15);
        let deduction_amount: f64 = row.get(16);
        let created_at: NaiveDateTime = row.get(17);
        let updated_at: NaiveDateTime = row.get(18);

        // Fetch minimal session summaries
        let session_rows = client.query(
            "SELECT session_id, cycle_number, status, started_at, inspection_date, version, result
             FROM packaging_project_sessions 
             WHERE project_id = $1 
             ORDER BY cycle_number ASC",
            &[&project_id]
        ).map_err(|e| format!("Failed to query session summaries for {}: {}", project_id, e))?;

        let mut sessions = Vec::new();
        for s_row in session_rows {
            let session_id: String = s_row.get(0);
            let s_started: NaiveDateTime = s_row.get(3);
            let s_inspect_date: Option<chrono::NaiveDate> = s_row.get(4);

            sessions.push(serde_json::json!({
                "session_id": session_id,
                "project_id": project_id,
                "cycle_number": s_row.get::<_, i32>(1),
                "status": s_row.get::<_, String>(2),
                "started_at": s_started.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
                "inspection_date": s_inspect_date.map(|d| d.format("%Y-%m-%d").to_string()),
                "version": s_row.get::<_, Option<String>>(5),
                "result": s_row.get::<_, Option<String>>(6),
            }));
        }

        let fabric_lines_json: serde_json::Value = match client.query(
            "SELECT id::text, label, fabric_sent, consumption_plan, cutt_plan, actual_consumption, short_roll, sisa_kain, kepala_kain, return_kain, created_by, created_at::text, production_group, overconsumption, fabric_price, deduction FROM packaging_project_fabric_lines WHERE project_id = $1 ORDER BY created_at ASC",
            &[&project_id],
        ) {
            Ok(fl_rows) => serde_json::Value::Array(fl_rows.iter().map(|r| serde_json::json!({
                "id": r.get::<_, Option<String>>(0),
                "label": r.get::<_, Option<String>>(1),
                "fabric_sent": r.get::<_, f64>(2),
                "consumption_plan": r.get::<_, f64>(3),
                "cutt_plan": r.get::<_, f64>(4),
                "actual_consumption": r.get::<_, f64>(5),
                "short_roll": r.get::<_, f64>(6),
                "sisa_kain": r.get::<_, f64>(7),
                "kepala_kain": r.get::<_, f64>(8),
                "return_kain": r.get::<_, f64>(9),
                "created_by": r.get::<_, Option<String>>(10),
                "created_at": r.get::<_, Option<String>>(11),
                "production_group": r.get::<_, Option<String>>(12),
                "overconsumption": r.get::<_, Option<f64>>(13),
                "fabric_price": r.get::<_, Option<f64>>(14),
                "deduction": r.get::<_, Option<f64>>(15),
            })).collect()),
            Err(_) => serde_json::Value::Array(vec![]),
        };

        projects.push(serde_json::json!({
            "project_id": project_id,
            "plm_id": plm_id,
            "brand": brand,
            "season": season,
            "article_name": article_name,
            "production_group": production_group,
            "po_info": po_info,
            "po_qty": po_qty,
            "po_plan_date": po_plan_date,
            "po_vendor": po_vendor,
            "status": status,
            "cmt_cut_job_id": cmt_cut_job_id,
            "cmt_pak_job_id": cmt_pak_job_id,
            "sales_price": sales_price,
            "verified_doc": verified_doc,
            "has_deduction": has_deduction,
            "deduction_amount": deduction_amount,
            "created_at": created_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "updated_at": updated_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "sessions": sessions,
            "fabric_lines": fabric_lines_json
        }));
    }

    Ok(serde_json::Value::Array(projects))
}

pub fn get_packaging_project_details(project_id: &str) -> Result<Value, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    
    let row = client.query_one("SELECT project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, sales_price, verified_doc, has_deduction, deduction_amount, created_at, updated_at FROM packaging_projects WHERE project_id = $1", &[&project_id])
        .map_err(|e| format!("Failed to query packaging project details: {}", e))?;
        
    let project_id: String = row.get(0);
    let plm_id: String = row.get(1);
    let brand: String = row.get(2);
    let season: String = row.get(3);
    let article_name: String = row.get(4);
    let production_group: String = row.get(5);
    let po_info: Option<String> = row.get(6);
    let po_qty: Option<f64> = row.get(7);
    let po_plan_date: Option<String> = row.get(8);
    let po_vendor: Option<String> = row.get(9);
    let status: String = row.get(10);
    let cmt_cut_job_id: Option<String> = row.get(11);
    let cmt_pak_job_id: Option<String> = row.get(12);
    let sales_price: Option<f64> = row.get(13);
    let verified_doc: Option<String> = row.get(14);
    let has_deduction: bool = row.get(15);
    let deduction_amount: f64 = row.get(16);
    let created_at: NaiveDateTime = row.get(17);
    let updated_at: NaiveDateTime = row.get(18);

    let base_report = serde_json::Value::Null;

    // Fetch base lines (CMT-Cut OData rows) using the existing client connection
    let base_lines_json = match get_packaging_project_reports_impl(&mut client, &project_id, None) {
        Ok(lines) => lines,
        Err(_) => serde_json::Value::Array(vec![]),
    };

    // Fetch sessions for this project
    let session_rows = client.query(
        "SELECT session_id, cycle_number, inspector_id, status, started_at, ended_at, inspection_date,
                check_wash, check_style_as_sample, check_main_label, check_flag_fit_label, check_print_embro_artwork,
                check_hangtag, check_waist_tag, check_barcode, check_packing_list, check_shipping_mark,
                check_other_1, check_other_1_label, check_other_2, check_other_2_label,
                qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs, finishing_pcs, packing_pcs, sampling_pcs,
                aql, level_val, factory_representative, inspector, version, result,
                approval_status, approved_by, approved_at::text, approval_source, approval_token::text, approval_email, approval_signature, ho_approval_signature,
                row_version, director_approval_signature, inspector_email
         FROM packaging_project_sessions
         WHERE project_id = $1
         ORDER BY cycle_number ASC",
        &[&project_id]
    ).map_err(|e| format!("Failed to query sessions for {}: {}", project_id, e))?;

    // Batch-fetch all deduction lines for this project's sessions in one query
    let session_ids_batch: Vec<String> = session_rows.iter().map(|r| r.get::<_, String>(0)).collect();
    let mut all_deduction_map: std::collections::HashMap<String, Vec<serde_json::Value>> = std::collections::HashMap::new();
    if !session_ids_batch.is_empty() {
        if let Ok(dl_batch) = client.query(
            "SELECT session_id, id::text, description, amount, created_by, created_at::text FROM packaging_session_deduction_lines WHERE session_id = ANY($1) ORDER BY created_at ASC",
            &[&session_ids_batch],
        ) {
            for r in dl_batch {
                let sid: String = r.get(0);
                all_deduction_map.entry(sid).or_default().push(serde_json::json!({
                    "id": r.get::<_, Option<String>>(1),
                    "description": r.get::<_, String>(2),
                    "amount": r.get::<_, f64>(3),
                    "created_by": r.get::<_, Option<String>>(4),
                    "created_at": r.get::<_, Option<String>>(5),
                }));
            }
        }
    }

    let mut sessions = Vec::new();
    for s_row in &session_rows {
        let session_id: String = s_row.get(0);
        let s_started: NaiveDateTime = s_row.get(4);
        let s_ended: Option<NaiveDateTime> = s_row.get(5);
        let s_inspect_date: Option<chrono::NaiveDate> = s_row.get(6);

        // Fetch session report lines (CMT-Pak lines for this session) using the existing client connection
        let mut session_lines_json = match get_packaging_project_reports_impl(&mut client, &project_id, Some(&session_id)) {
            Ok(lines) => lines,
            Err(_) => serde_json::Value::Array(vec![]),
        };

        // Auto-recovery safety fallback: if session has 0 lines, populate it by duplicating INITIAL_PAK lines
        if let Some(arr) = session_lines_json.as_array() {
            if arr.is_empty() {
                let _ = client.execute(
                    "INSERT INTO packaging_project_reports (
                        report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                        item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                        reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                        total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                        reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                     )
                     SELECT 
                        $1 || '_LINE_' || (row_number() OVER (ORDER BY line_no ASC, global_display_order ASC))::text, 
                        $1, 
                        project_id, data_area_id, line_no, job_transaction_id,
                        item_id, size_val, global_display_order, 0, 0,
                        0, qty_order, total_qty_sample, 0, 0,
                        total_reject_qty, 0, ref_rec_id, total_good_qty, 0,
                        0, gramasi, 0, 0, 0.0, 'v1.0', NOW()
                     FROM packaging_project_reports
                     WHERE project_id = $2 AND session_id = 'INITIAL_PAK'",
                    &[&session_id, &project_id]
                );

                // Re-query the report lines after duplication using the existing client connection
                if let Ok(lines) = get_packaging_project_reports_impl(&mut client, &project_id, Some(&session_id)) {
                    session_lines_json = lines;
                }
            }
        }

        let deduction_lines_json = serde_json::Value::Array(
            all_deduction_map.get(&session_id).cloned().unwrap_or_default()
        );

        sessions.push(serde_json::json!({
            "session_id": session_id,
            "project_id": project_id,
            "cycle_number": s_row.get::<_, i32>(1),
            "inspector_id": s_row.get::<_, String>(2),
            "status": s_row.get::<_, String>(3),
            "started_at": s_started.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "ended_at": s_ended.map(|t| t.format("%Y-%m-%dT%H:%M:%S.000Z").to_string()),
            "inspection_date": s_inspect_date.map(|d| d.format("%Y-%m-%d").to_string()),
            "check_wash": s_row.get::<_, bool>(7),
            "check_style_as_sample": s_row.get::<_, bool>(8),
            "check_main_label": s_row.get::<_, bool>(9),
            "check_flag_fit_label": s_row.get::<_, bool>(10),
            "check_print_embro_artwork": s_row.get::<_, bool>(11),
            "check_hangtag": s_row.get::<_, bool>(12),
            "check_waist_tag": s_row.get::<_, bool>(13),
            "check_barcode": s_row.get::<_, bool>(14),
            "check_packing_list": s_row.get::<_, bool>(15),
            "check_shipping_mark": s_row.get::<_, bool>(16),
            "check_other_1": s_row.get::<_, bool>(17),
            "check_other_1_label": s_row.get::<_, Option<String>>(18),
            "check_other_2": s_row.get::<_, bool>(19),
            "check_other_2_label": s_row.get::<_, Option<String>>(20),
            "qty_available": s_row.get::<_, i32>(21),
            "total_store": s_row.get::<_, i32>(22),
            "store_inspected": s_row.get::<_, i32>(23),
            "cutting_pcs": s_row.get::<_, i32>(24),
            "sewing_pcs": s_row.get::<_, i32>(25),
            "finishing_pcs": s_row.get::<_, i32>(26),
            "packing_pcs": s_row.get::<_, i32>(27),
            "sampling_pcs": s_row.get::<_, i32>(28),
            "aql": s_row.get::<_, f64>(29),
            "level_val": s_row.get::<_, f64>(30),
            "factory_representative": s_row.get::<_, Option<String>>(31),
            "inspector": s_row.get::<_, Option<String>>(32),
            "version": s_row.get::<_, Option<String>>(33),
            "result": s_row.get::<_, Option<String>>(34),
            "approval_status": s_row.get::<_, Option<String>>(35),
            "approved_by": s_row.get::<_, Option<String>>(36),
            "approved_at": s_row.get::<_, Option<String>>(37),
            "approval_source": s_row.get::<_, Option<String>>(38),
            "approval_token": s_row.get::<_, Option<String>>(39),
            "approval_email": s_row.get::<_, Option<String>>(40),
            "approval_signature": s_row.get::<_, Option<String>>(41),
            "ho_approval_signature": s_row.get::<_, Option<String>>(42),
            "row_version": s_row.get::<_, Option<i32>>(43),
            "director_approval_signature": s_row.get::<_, Option<String>>(44),
            "inspector_email": s_row.get::<_, Option<String>>(45),
            "report_lines": session_lines_json,
            "deduction_lines": deduction_lines_json
        }));
    }

    // Fetch defect images for this project
    let image_rows = client.query(
        "SELECT image_id, session_id, image_path, defect_type, description, major, minor, captured_at 
         FROM packaging_defect_images 
         WHERE project_id = $1 
         ORDER BY captured_at DESC",
        &[&project_id]
    ).map_err(|e| format!("Failed to query images for {}: {}", project_id, e))?;

    let mut defect_images = Vec::new();
    for img_row in image_rows {
        let img_captured: NaiveDateTime = img_row.get(7);
        defect_images.push(serde_json::json!({
            "image_id": img_row.get::<_, String>(0),
            "project_id": project_id,
            "session_id": img_row.get::<_, Option<String>>(1),
            "image_path": img_row.get::<_, String>(2),
            "defect_type": img_row.get::<_, String>(3),
            "description": img_row.get::<_, Option<String>>(4),
            "major": img_row.get::<_, i32>(5),
            "minor": img_row.get::<_, i32>(6),
            "captured_at": img_captured.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
        }));
    }

    let fabric_lines_json: serde_json::Value = match client.query(
        "SELECT id::text, label, fabric_sent, consumption_plan, cutt_plan, actual_consumption, short_roll, sisa_kain, kepala_kain, return_kain, created_by, created_at::text, production_group, overconsumption, fabric_price, deduction FROM packaging_project_fabric_lines WHERE project_id = $1 ORDER BY created_at ASC",
        &[&project_id],
    ) {
        Ok(fl_rows) => serde_json::Value::Array(fl_rows.iter().map(|r| serde_json::json!({
            "id": r.get::<_, Option<String>>(0),
            "label": r.get::<_, Option<String>>(1),
            "fabric_sent": r.get::<_, f64>(2),
            "consumption_plan": r.get::<_, f64>(3),
            "cutt_plan": r.get::<_, f64>(4),
            "actual_consumption": r.get::<_, f64>(5),
            "short_roll": r.get::<_, f64>(6),
            "sisa_kain": r.get::<_, f64>(7),
            "kepala_kain": r.get::<_, f64>(8),
            "return_kain": r.get::<_, f64>(9),
            "created_by": r.get::<_, Option<String>>(10),
            "created_at": r.get::<_, Option<String>>(11),
            "production_group": r.get::<_, Option<String>>(12),
            "overconsumption": r.get::<_, Option<f64>>(13),
            "fabric_price": r.get::<_, Option<f64>>(14),
            "deduction": r.get::<_, Option<f64>>(15),
        })).collect()),
        Err(_) => serde_json::Value::Array(vec![]),
    };

    let remarks_text: Option<String> = match client.query_opt(
        "SELECT remarks FROM packaging_project_remarks WHERE production_group = $1",
        &[&production_group],
    ) {
        Ok(Some(row)) => row.get(0),
        _ => None,
    };

    Ok(serde_json::json!({
        "project_id": project_id,
        "plm_id": plm_id,
        "brand": brand,
        "season": season,
        "article_name": article_name,
        "production_group": production_group,
        "po_info": po_info,
        "po_qty": po_qty,
        "po_plan_date": po_plan_date,
        "po_vendor": po_vendor,
        "status": status,
        "cmt_cut_job_id": cmt_cut_job_id,
        "cmt_pak_job_id": cmt_pak_job_id,
        "sales_price": sales_price,
        "verified_doc": verified_doc,
        "has_deduction": has_deduction,
        "deduction_amount": deduction_amount,
        "created_at": created_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
        "updated_at": updated_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
        "base_report": base_report,
        "base_lines": base_lines_json,
        "sessions": sessions,
        "defect_images": defect_images,
        "fabric_lines": fabric_lines_json,
        "remarks": remarks_text
    }))
}

pub fn read_offline_projects_cache(app: AppHandle) -> Result<Value, String> {
    let cache_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let cache_path = cache_dir.join("packaging_projects_cache.json");
    
    if !cache_path.exists() {
        return Ok(serde_json::json!([]));
    }
    
    let content = std::fs::read_to_string(&cache_path)
        .map_err(|e| format!("Failed to read cache file: {}", e))?;
        
    let val: Value = serde_json::from_str(&content).unwrap_or_else(|_| {
        println!("Warning: Cache file is corrupted, returning empty array");
        serde_json::json!([])
    });
    
    Ok(val)
}

pub fn write_offline_projects_cache(app: AppHandle, data: Value) -> Result<(), String> {
    let cache_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    
    // Ensure parent directory exists
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create local data directory: {}", e))?;
        
    let cache_path = cache_dir.join("packaging_projects_cache.json");
    
    let content = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to serialize cache data: {}", e))?;
        
    std::fs::write(&cache_path, content)
        .map_err(|e| format!("Failed to write cache file: {}", e))?;
        
    Ok(())
}


pub fn save_session_approval_info(project_id: &str, session_id: &str, approval_token: &str, approval_email: &str, inspector_name: &str, inspector_email: &str) -> Result<(), String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    // Re-send resets the WHOLE chain (full restart): factory-rep, HO, and
    // director signatures are all cleared. The inspector's device profile
    // (name + email) is stamped on so the portal can notify them of rejections
    // and the completion; the manually-entered inspector field wins if present.
    client.execute(
        "UPDATE packaging_project_sessions
         SET approval_token = CAST($1::text AS uuid), approval_email = $2, approval_status = NULL,
             approval_signature = NULL, approved_by = NULL, approved_at = NULL,
             ho_approval_signature = NULL, director_approval_signature = NULL,
             inspector_email = NULLIF($5, ''),
             inspector = CASE WHEN inspector IS NULL OR inspector = '' THEN NULLIF($6, '') ELSE inspector END
         WHERE session_id = $3 AND project_id = $4",
        &[&approval_token, &approval_email, &session_id, &project_id, &inspector_email, &inspector_name]
    ).map_err(|e| format!("Failed to update approval token and email: {}", e))?;
    Ok(())
}

pub fn reset_session_approval_info(project_id: &str, session_id: &str) -> Result<(), String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    client.execute(
        "UPDATE packaging_project_sessions
         SET approval_token = NULL, approval_email = NULL, approval_status = NULL,
             approved_by = NULL, approved_at = NULL, approval_signature = NULL,
             ho_approval_signature = NULL, director_approval_signature = NULL
         WHERE session_id = $1 AND project_id = $2",
        &[&session_id, &project_id]
    ).map_err(|e| format!("Failed to reset approval info: {}", e))?;
    Ok(())
}

pub fn save_project_verification_doc(project_id: &str, doc_base64: &str) -> Result<(), String> {
    let mut client = get_connection_qms()?;
    client.execute(
        "UPDATE packaging_projects SET verified_doc = $1, updated_at = NOW() WHERE project_id = $2",
        &[&doc_base64, &project_id]
    ).map_err(|e| format!("Failed to update verification doc: {}", e))?;
    Ok(())
}

pub fn refresh_packaging_project_lines(project_id: &str) -> Result<(), String> {
    let mut client = get_connection_qms()?;

    // 1. Retrieve project header to get production group
    let row = client.query_one(
        "SELECT production_group FROM packaging_projects WHERE project_id = $1",
        &[&project_id]
    ).map_err(|e| format!("Failed to find project: {}", e))?;
    let prod_group: String = row.get(0);

    // 2. Fetch credentials and token
    let creds = get_d365_creds()
        .map_err(|e| format!("Failed to retrieve credentials: {}", e))?;
    let token = get_d365_token(&creds)
        .map_err(|e| format!("Failed to fetch token: {}", e))?;

    // 3. Query JobTransactionHeaders for latest job ids
    let filter_str = format!("ProductionGroup eq '{}'", prod_group);
    let encoded_filter = percent_encode(&filter_str);
    let headers_url = format!("{}/data/JobTransactionHeaders?$filter={}", creds.resource, encoded_filter);

    let mut cut_job_id = None;
    let mut cut_created = String::new();
    let mut pak_job_id = None;
    let mut pak_created = String::new();

    match call_curl_get(&headers_url, &token) {
        Ok(resp) => {
            if let Some(records) = resp["value"].as_array() {
                for rec in records {
                    let op = rec["Operation"].as_str().unwrap_or("");
                    let job_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
                    let created_str = rec["CreatedDateTime1"].as_str().unwrap_or("");
                    let op_upper = op.to_uppercase();
                    if op_upper == "CMT-CUT" {
                        if cut_job_id.is_none() || created_str > cut_created.as_str() {
                            cut_job_id = job_id;
                            cut_created = created_str.to_string();
                        }
                    } else if op_upper == "CMT-PAK" && (pak_job_id.is_none() || created_str > pak_created.as_str()) {
                        pak_job_id = job_id;
                        pak_created = created_str.to_string();
                    }
                }
            } else if let Some(err_msg) = resp["error"]["message"].as_str() {
                println!("Warning: refresh_packaging_project_lines - Dynamics 365 OData error: {}", err_msg);
            } else {
                println!("Warning: refresh_packaging_project_lines - response value is not an array: {:?}", resp);
            }
        }
        Err(e) => {
            println!("Warning: refresh_packaging_project_lines - Failed to query JobTransactionHeaders: {}", e);
        }
    }

    // 4. Update the job IDs in packaging_projects only if we found any in ERP, or keep the existing ones
    let existing_row = client.query_one(
        "SELECT cmt_cut_job_id, cmt_pak_job_id FROM packaging_projects WHERE project_id = $1",
        &[&project_id]
    ).map_err(|e| format!("Failed to query existing project: {}", e))?;
    let existing_cut: Option<String> = existing_row.get(0);
    let existing_pak: Option<String> = existing_row.get(1);

    let final_cut_job = cut_job_id.or(existing_cut);
    let final_pak_job = pak_job_id.or(existing_pak);

    client.execute(
        "UPDATE packaging_projects 
         SET cmt_cut_job_id = $1, cmt_pak_job_id = $2, updated_at = NOW() 
         WHERE project_id = $3",
        &[&final_cut_job, &final_pak_job, &project_id]
    ).map_err(|e| format!("Failed to update project job IDs: {}", e))?;

    // 5. Fetch and store the new baseline/template lines first
    let mut qms_client = get_connection_qms()?;
    let mut fetched_cut = false;
    let mut fetched_pak = false;

    if let Some(ref cut_id) = final_cut_job {
        if fetch_and_store_lines(&creds, &token, &mut qms_client, project_id, cut_id, None).is_ok() {
            fetched_cut = true;
        }
    }
    if let Some(ref pak_id) = final_pak_job {
        if fetch_and_store_lines(&creds, &token, &mut qms_client, project_id, pak_id, Some("INITIAL_PAK")).is_ok() {
            fetched_pak = true;
        }
    }

    // Only delete old reports if we successfully fetched the new ones!
    if fetched_cut || fetched_pak {
        let mut delete_query = "DELETE FROM packaging_project_reports WHERE project_id = $1 AND (session_id IS NULL OR session_id = 'INITIAL_PAK')".to_string();
        let mut params: Vec<&(dyn postgres::types::ToSql + Sync)> = vec![&project_id];

        // We only keep the new job transaction IDs
        if let Some(ref cut_id) = final_cut_job {
            delete_query.push_str(" AND job_transaction_id != $2");
            params.push(cut_id);
        }
        if let Some(ref pak_id) = final_pak_job {
            let param_idx = params.len() + 1;
            delete_query.push_str(&format!(" AND job_transaction_id != ${}", param_idx));
            params.push(pak_id);
        }

        let _ = client.execute(&delete_query, &params[..]);
    } else {
        // If we failed to fetch anything from D365, check if we currently have zero reports in the database.
        // If so, fall back to seeding directly from production_group_lines in VSM reference DB so the style size variations are populated.
        let report_count: i64 = client.query_one(
            "SELECT COUNT(*) FROM packaging_project_reports WHERE project_id = $1 AND (session_id IS NULL OR session_id = 'INITIAL_PAK')",
            &[&project_id]
        ).map(|r| r.get(0)).unwrap_or(0);

        if report_count == 0 {
            // We need plm_id to call seed_reports_from_production_group_lines
            let plm_row = client.query_one(
                "SELECT plm_id FROM packaging_projects WHERE project_id = $1",
                &[&project_id]
            ).map_err(|e| format!("Failed to find project PLM ID: {}", e))?;
            let plm_id: String = plm_row.get(0);

            if let Err(e) = seed_reports_from_production_group_lines(&mut qms_client, project_id, &prod_group, &plm_id) {
                println!("Warning: refresh_packaging_project_lines fallback seeding from VSM failed: {}", e);
            }
        }
    }

    Ok(())
}

pub fn delete_packaging_project(project_id: &str) -> Result<(), String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    
    client.execute(
        "UPDATE packaging_projects SET status = CASE WHEN status = 'completed' THEN 'removed_completed' ELSE 'removed' END, updated_at = NOW() WHERE project_id = $1",
        &[&project_id],
    )
    .map_err(|e| format!("Failed to update project status to removed: {}", e))?;

    Ok(())
}

pub fn find_removed_project_by_prg(prg: &str) -> Result<Option<(String, String)>, String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    let rows = client.query(
        "SELECT project_id, status FROM packaging_projects WHERE production_group = $1 AND status IN ('removed', 'removed_completed') ORDER BY updated_at DESC LIMIT 1",
        &[&prg],
    ).map_err(|e| format!("Failed to query removed project: {}", e))?;
    if let Some(row) = rows.into_iter().next() {
        let project_id: String = row.get(0);
        let status: String = row.get(1);
        Ok(Some((project_id, status)))
    } else {
        Ok(None)
    }
}

pub fn restore_packaging_project(project_id: &str, restore_status: &str) -> Result<(), String> {
    ensure_init();
    let mut client = get_connection_qms()?;
    client.execute(
        "UPDATE packaging_projects SET status = $1, updated_at = NOW() WHERE project_id = $2",
        &[&restore_status, &project_id],
    ).map_err(|e| format!("Failed to restore packaging project: {}", e))?;
    Ok(())
}

// D365 credentials model
struct D365Creds {
    tenant_id: String,
    client_id: String,
    client_secret: String,
    resource: String,
}

// Percent encoding helper for D365 OData requests
fn percent_encode(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

// Query active environment credentials from VSM database
fn get_d365_creds() -> Result<D365Creds, String> {
    let mut client = get_connection_vsm()?;
    let rows = client.query("SELECT key, value FROM d365_env", &[])
        .map_err(|e| format!("Failed to query d365_env from VSM: {}", e))?;

    let mut tenant_id = None;
    let mut client_id = None;
    let mut client_secret = None;
    let mut resource = None;

    for row in rows {
        let k: String = row.get(0);
        let v: String = row.get(1);
        match k.as_str() {
            "D365_TENANT_ID" => tenant_id = Some(v),
            "D365_CLIENT_ID" => client_id = Some(v),
            "D365_CLIENT_SECRET" => client_secret = Some(v),
            "D365_RESOURCE" => resource = Some(v),
            _ => {}
        }
    }

    Ok(D365Creds {
        tenant_id: tenant_id.ok_or("Missing D365_TENANT_ID in d365_env")?,
        client_id: client_id.ok_or("Missing D365_CLIENT_ID in d365_env")?,
        client_secret: client_secret.ok_or("Missing D365_CLIENT_SECRET in d365_env")?,
        resource: resource.ok_or("Missing D365_RESOURCE in d365_env")?,
    })
}

// Helper to execute standard curl POST requests (used for OAuth2 token acquisition)
fn call_curl_post(url: &str, body: &str) -> Result<serde_json::Value, String> {
    let mut cmd = std::process::Command::new("curl");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .arg("-s")
        .arg("-X")
        .arg("POST")
        .arg("-H")
        .arg("Content-Type: application/x-www-form-urlencoded")
        .arg("-d")
        .arg(body)
        .arg(url)
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl POST failed with status {}: {}", output.status, err_str));
    }

    let res_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&res_str)
        .map_err(|e| format!("Failed to parse JSON response from curl: {}. Response: {}", e, res_str))?;

    Ok(json)
}

// Helper to execute authenticated curl GET requests (used for OData endpoint queries)
fn call_curl_get(url: &str, token: &str) -> Result<serde_json::Value, String> {
    let mut cmd = std::process::Command::new("curl");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .arg("-s")
        .arg("-H")
        .arg(format!("Authorization: Bearer {}", token))
        .arg("-H")
        .arg("Accept: application/json")
        .arg(url)
        .output()
        .map_err(|e| format!("Failed to execute curl: {}", e))?;

    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        return Err(format!("curl GET failed with status {}: {}", output.status, err_str));
    }

    let res_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&res_str)
        .map_err(|e| format!("Failed to parse JSON response from curl: {}. Response: {}", e, res_str))?;

    Ok(json)
}

// Fetch Microsoft Entra OAuth2 access token
fn get_d365_token(creds: &D365Creds) -> Result<String, String> {
    let url = format!("https://login.microsoftonline.com/{}/oauth2/v2.0/token", creds.tenant_id);
    let body = format!(
        "grant_type=client_credentials&client_id={}&client_secret={}&scope={}/.default",
        percent_encode(&creds.client_id),
        percent_encode(&creds.client_secret),
        percent_encode(&creds.resource)
    );

    let resp = call_curl_post(&url, &body)?;
    let token = resp["access_token"].as_str()
        .ok_or_else(|| format!("Token response missing access_token: {:?}", resp))?;

    Ok(token.to_string())
}

// Fetch sales price from ReleasedProductMastersV2 for a given PLM Id
fn fetch_odata_sales_price(creds: &D365Creds, token: &str, plm_id: &str) -> Result<f64, String> {
    let filter_str = format!("ItemNumber eq '{}'", plm_id);
    let encoded_filter = percent_encode(&filter_str);
    let url = format!("{}/data/ReleasedProductMastersV2?$filter={}", creds.resource, encoded_filter);

    let resp: serde_json::Value = call_curl_get(&url, token)
        .map_err(|e| format!("Failed to call ReleasedProductMastersV2 OData: {}", e))?;

    let records = resp["value"].as_array()
        .ok_or_else(|| format!("Invalid response format for ReleasedProductMastersV2: {:?}", resp))?;

    if let Some(first_rec) = records.first() {
        let sales_price = first_rec["SalesPrice"].as_f64()
            .or_else(|| first_rec["SalesPrice"].as_i64().map(|n| n as f64))
            .ok_or_else(|| format!("Sales price field 'SalesPrice' is missing or not a valid number in ReleasedProductMastersV2 record for item {}", plm_id))?;
        Ok(sales_price)
    } else {
        Err(format!("No product master record found in ReleasedProductMastersV2 for item number '{}'", plm_id))
    }
}

// Fetch CMT-Cut and CMT-Pak Job IDs and seed baseline and templates locally
#[allow(dead_code)]
pub fn fetch_odata_jobs_and_lines(project_id: &str, production_group: &str) -> Result<(Option<String>, Option<String>), String> {
    let creds = match get_d365_creds() {
        Ok(c) => c,
        Err(e) => {
            println!("fetch_odata_jobs_and_lines: Could not fetch credentials from DB, returning offline defaults. Err: {}", e);
            return Ok((None, None));
        }
    };

    let token = match get_d365_token(&creds) {
        Ok(t) => t,
        Err(e) => {
            println!("fetch_odata_jobs_and_lines: Failed to get OAuth2 token: {}. Continuing offline.", e);
            return Ok((None, None));
        }
    };

    // Filter headers by production group
    let filter_str = format!("ProductionGroup eq '{}'", production_group);
    let encoded_filter = percent_encode(&filter_str);
    let headers_url = format!("{}/data/JobTransactionHeaders?$filter={}", creds.resource, encoded_filter);

    let resp: serde_json::Value = match call_curl_get(&headers_url, &token) {
        Ok(json) => json,
        Err(e) => {
            println!("fetch_odata_jobs_and_lines: Failed to query JobTransactionHeaders: {}. Continuing.", e);
            return Ok((None, None));
        }
    };

    let records = resp["value"].as_array().ok_or_else(|| format!("Invalid response format for JobTransactionHeaders: {:?}", resp))?;

    let mut cut_job_id = None;
    let mut cut_created = String::new();
    let mut pak_job_id = None;
    let mut pak_created = String::new();

    for rec in records {
        let op = rec["Operation"].as_str().unwrap_or("");
        let op_upper = op.to_uppercase();
        let job_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
        let created_str = rec["CreatedDateTime1"].as_str().unwrap_or("");
        if op_upper == "CMT-CUT" {
            if cut_job_id.is_none() || created_str > cut_created.as_str() {
                cut_job_id = job_id;
                cut_created = created_str.to_string();
            }
        } else if op_upper == "CMT-PAK" && (pak_job_id.is_none() || created_str > pak_created.as_str()) {
            pak_job_id = job_id;
            pak_created = created_str.to_string();
        }
    }

    let mut qms_client = get_connection_qms()?;

    // Fetch and seed CMT-Cut lines (baseline reports, session_id = NULL)
    if let Some(ref cut_id) = cut_job_id {
        if let Err(e) = fetch_and_store_lines(&creds, &token, &mut qms_client, project_id, cut_id, None) {
            println!("Warning: Failed to fetch/store CMT-Cut lines: {}", e);
        }
    }

    // Fetch and seed CMT-Pak lines (session templates, session_id = 'INITIAL_PAK')
    if let Some(ref pak_id) = pak_job_id {
        if let Err(e) = fetch_and_store_lines(&creds, &token, &mut qms_client, project_id, pak_id, Some("INITIAL_PAK")) {
            println!("Warning: Failed to fetch/store CMT-Pak lines: {}", e);
        }
    }

    Ok((cut_job_id, pak_job_id))
}

// Fetch line details for a job transaction and store them locally
fn fetch_and_store_lines(
    creds: &D365Creds,
    token: &str,
    qms_client: &mut postgres::Client,
    project_id: &str,
    job_id: &str,
    session_id: Option<&str>
) -> Result<(), String> {
    let target_job_id = job_id.split_whitespace().next().unwrap_or(job_id);
    let filter_str = format!("JobTransactionId eq '{}'", target_job_id);
    let encoded_filter = percent_encode(&filter_str);
    let lines_url = format!("{}/data/JobTransactionLinesDetails?$filter={}", creds.resource, encoded_filter);

    let resp: serde_json::Value = call_curl_get(&lines_url, token)
        .map_err(|e| format!("Failed to call lines OData: {}", e))?;

    let records = resp["value"].as_array().ok_or_else(|| format!("Invalid response format for JobTransactionLinesDetails: {:?}", resp))?;

    // 1. Delete existing report lines for this project and session to prevent duplicate/stale records
    if let Some(sess_id) = session_id {
        let _ = qms_client.execute(
            "DELETE FROM packaging_project_reports WHERE project_id = $1 AND session_id = $2",
            &[&project_id, &sess_id]
        );
    } else {
        let _ = qms_client.execute(
            "DELETE FROM packaging_project_reports WHERE project_id = $1 AND session_id IS NULL",
            &[&project_id]
        );
    }

    // 2. Filter duplicate size lines from D365, keeping only the latest record for each size
    let mut unique_sizes = Vec::new();
    let mut latest_records = std::collections::HashMap::new();
    for (idx, rec) in records.iter().enumerate() {
        let size_val = rec["Size"].as_str().map(|s| s.trim().to_string()).unwrap_or_default();
        let size_key = if size_val.is_empty() {
            format!("unknown_{}", idx)
        } else {
            size_val
        };

        if !latest_records.contains_key(&size_key) {
            unique_sizes.push(size_key.clone());
        }
        latest_records.insert(size_key, rec.clone());
    }

    // 3. Insert the deduplicated rows
    for size_key in &unique_sizes {
        if let Some(rec) = latest_records.get(size_key) {
            let data_area_id = rec["dataAreaId"].as_str().map(|s| s.to_string());
            let line_no = rec["No"].as_i64().map(|n| n as i32);
            let job_transaction_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
            let item_id = rec["ItemId"].as_str().map(|s| s.to_string());
            let size_val = rec["Size"].as_str().map(|s| s.trim().to_string());
            let global_display_order = rec["GlobalDisplayOrder"].as_i64().map(|n| n as i32);
            let reject_produksi = rec["RejectProduksi"].as_i64().map(|n| n as i32);
            let reject_finishing = rec["RejectFinishing"].as_i64().map(|n| n as i32);
            let reject_embro = rec["RejectEmbro"].as_i64().map(|n| n as i32);
            let qty_order = rec["QtyOrder"].as_i64().map(|n| n as i32);
            let total_qty_sample = rec["TotalQtySample"].as_i64().map(|n| n as i32);
            let barang_hilang = rec["BarangHilang"].as_i64().map(|n| n as i32);
            let reject_cutting = rec["RejectCutting"].as_i64().map(|n| n as i32);
            let total_reject_qty = rec["TotalRejectQty"].as_i64().map(|n| n as i32);
            let reject_printing = rec["RejectPrinting"].as_i64().map(|n| n as i32);
            let ref_rec_id = rec["RefRecId"].as_i64();
            let total_good_qty = rec["TotalGoodQty"].as_i64().map(|n| n as i32);
            let reject_sewing = rec["RejectSewing"].as_i64().map(|n| n as i32);
            let reject_washing = rec["RejectWashing"].as_i64().map(|n| n as i32);
            let gramasi = rec["Gramasi"].as_f64().or_else(|| rec["Gramasi"].as_i64().map(|n| n as f64));
            let btj = rec["BTJ"].as_i64().map(|n| n as i32);
            let reject_bahan = rec["RejectBahan"].as_i64().map(|n| n as i32);

            let report_id = format!("{}_{}_{}", project_id, target_job_id, size_key);

            qms_client.execute(
                "INSERT INTO packaging_project_reports (
                    report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                    item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                    reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                    total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                    reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 0.0, 'v1.0', NOW())
                 ON CONFLICT (report_id)
                 DO UPDATE SET 
                    session_id = $2, project_id = $3, data_area_id = $4, line_no = $5, job_transaction_id = $6,
                    item_id = $7, size_val = $8, global_display_order = $9, reject_produksi = $10, reject_finishing = $11,
                    reject_embro = $12, qty_order = $13, total_qty_sample = $14, barang_hilang = $15, reject_cutting = $16,
                    total_reject_qty = $17, reject_printing = $18, ref_rec_id = $19, total_good_qty = $20, reject_sewing = $21,
                    reject_washing = $22, gramasi = $23, btj = $24, reject_bahan = $25",
                &[
                    &report_id,
                    &session_id,
                    &project_id,
                    &data_area_id,
                    &line_no,
                    &job_transaction_id,
                    &item_id,
                    &size_val,
                    &global_display_order,
                    &reject_produksi,
                    &reject_finishing,
                    &reject_embro,
                    &qty_order,
                    &total_qty_sample,
                    &barang_hilang,
                    &reject_cutting,
                    &total_reject_qty,
                    &reject_printing,
                    &ref_rec_id,
                    &total_good_qty,
                    &reject_sewing,
                    &reject_washing,
                    &gramasi,
                    &btj,
                    &reject_bahan,
                ]
            ).map_err(|e| format!("Failed to insert packaging project report row: {}", e))?;
        }
    }

    Ok(())
}

// Retrieve local packaging project report lines (either base/CMT-Cut or session/CMT-Pak lines)
pub fn get_packaging_project_reports_impl(client: &mut Client, project_id: &str, session_id: Option<&str>) -> Result<Value, String> {
    let mut list = Vec::new();

    let rows = match session_id {
        Some(sid) => {
            client.query(
                "SELECT report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                        item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                        reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                        total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                        reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                 FROM packaging_project_reports
                 WHERE project_id = $1 AND session_id = $2
                 ORDER BY line_no ASC, global_display_order ASC",
                &[&project_id, &sid]
            ).map_err(|e| format!("Failed to query packaging project reports by session: {}", e))?
        }
        None => {
            client.query(
                "SELECT report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                        item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                        reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                        total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                        reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
                 FROM packaging_project_reports
                 WHERE project_id = $1 AND session_id IS NULL
                 ORDER BY line_no ASC, global_display_order ASC",
                &[&project_id]
            ).map_err(|e| format!("Failed to query packaging project reports base: {}", e))?
        }
    };

    for row in rows {
        let created_at: NaiveDateTime = row.get(27);
        list.push(serde_json::json!({
            "report_id": row.get::<_, String>(0),
            "session_id": row.get::<_, Option<String>>(1),
            "project_id": row.get::<_, String>(2),
            "data_area_id": row.get::<_, Option<String>>(3),
            "line_no": row.get::<_, Option<i32>>(4),
            "job_transaction_id": row.get::<_, Option<String>>(5),
            "item_id": row.get::<_, Option<String>>(6),
            "size_val": row.get::<_, Option<String>>(7),
            "global_display_order": row.get::<_, Option<i32>>(8),
            "reject_produksi": row.get::<_, Option<i32>>(9),
            "reject_finishing": row.get::<_, Option<i32>>(10),
            "reject_embro": row.get::<_, Option<i32>>(11),
            "qty_order": row.get::<_, Option<i32>>(12),
            "total_qty_sample": row.get::<_, Option<i32>>(13),
            "barang_hilang": row.get::<_, Option<i32>>(14),
            "reject_cutting": row.get::<_, Option<i32>>(15),
            "total_reject_qty": row.get::<_, Option<i32>>(16),
            "reject_printing": row.get::<_, Option<i32>>(17),
            "ref_rec_id": row.get::<_, Option<i64>>(18),
            "total_good_qty": row.get::<_, Option<i32>>(19),
            "reject_sewing": row.get::<_, Option<i32>>(20),
            "reject_washing": row.get::<_, Option<i32>>(21),
            "gramasi": row.get::<_, Option<f64>>(22),
            "btj": row.get::<_, Option<i32>>(23),
            "reject_bahan": row.get::<_, Option<i32>>(24),
            "session_qty": row.get::<_, f64>(25),
            "session_version": row.get::<_, Option<String>>(26),
            "created_at": created_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
        }));
    }

    Ok(serde_json::Value::Array(list))
}

pub fn get_packaging_project_reports(project_id: &str, session_id: Option<&str>) -> Result<Value, String> {
    let mut client = get_connection_qms()?;
    get_packaging_project_reports_impl(&mut client, project_id, session_id)
}

// Bulk save packaging project reports
pub fn save_packaging_project_reports(reports: Vec<PackagingProjectReport>) -> Result<(), String> {
    let mut client = get_connection_qms()?;

    for report in reports {
        client.execute(
            "INSERT INTO packaging_project_reports (
                report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW())
             ON CONFLICT (report_id)
             DO UPDATE SET 
                session_id = $2, project_id = $3, data_area_id = $4, line_no = $5, job_transaction_id = $6,
                item_id = $7, size_val = $8, global_display_order = $9, reject_produksi = $10, reject_finishing = $11,
                reject_embro = $12, qty_order = $13, total_qty_sample = $14, barang_hilang = $15, reject_cutting = $16,
                total_reject_qty = $17, reject_printing = $18, ref_rec_id = $19, total_good_qty = $20, reject_sewing = $21,
                reject_washing = $22, gramasi = $23, btj = $24, reject_bahan = $25, session_qty = $26, session_version = $27",
            &[
                &report.report_id,
                &report.session_id,
                &report.project_id,
                &report.data_area_id,
                &report.line_no,
                &report.job_transaction_id,
                &report.item_id,
                &report.size_val,
                &report.global_display_order,
                &report.reject_produksi,
                &report.reject_finishing,
                &report.reject_embro,
                &report.qty_order,
                &report.total_qty_sample,
                &report.barang_hilang,
                &report.reject_cutting,
                &report.total_reject_qty,
                &report.reject_printing,
                &report.ref_rec_id,
                &report.total_good_qty,
                &report.reject_sewing,
                &report.reject_washing,
                &report.gramasi,
                &report.btj,
                &report.reject_bahan,
                &report.session_qty,
                &report.session_version,
            ]
        ).map_err(|e| format!("Failed to save packaging project report row: {}", e))?;
    }

    Ok(())
}

fn seed_reports_from_production_group_lines(
    qms_client: &mut postgres::Client,
    project_id: &str,
    production_group: &str,
    plm_id: &str,
) -> Result<(), String> {
    let mut vsm_client = get_connection_vsm()?;
    let rows = vsm_client.query(
        "SELECT \"ItemId\", \"Size\", \"Qty\", \"LineNum\"
         FROM production_group_lines
         WHERE \"ProductionGroup\" = $1",
        &[&production_group]
    ).map_err(|e| format!("Failed to query production_group_lines from VSM: {}", e))?;

    if rows.is_empty() {
        // Fallback to PLMId if ProductionGroup is empty or has no lines
        let alt_rows = vsm_client.query(
            "SELECT \"ItemId\", \"Size\", \"Qty\", \"LineNum\"
             FROM production_group_lines
             WHERE \"ProductionGroup\" = (SELECT \"ProductionGroup\" FROM plm_activity WHERE \"PLMId\" = $1)",
            &[&plm_id]
        ).unwrap_or_default();
        if !alt_rows.is_empty() {
            return seed_rows_to_reports(qms_client, project_id, &alt_rows);
        }
    } else {
        return seed_rows_to_reports(qms_client, project_id, &rows);
    }

    Ok(())
}

fn seed_rows_to_reports(
    qms_client: &mut postgres::Client,
    project_id: &str,
    rows: &[postgres::Row],
) -> Result<(), String> {
    for (idx, row) in rows.iter().enumerate() {
        let item_id: Option<String> = row.get(0);
        let size_val: Option<String> = row.get(1);
        let qty: Option<i32> = row.get(2);
        let line_no: Option<i32> = row.get(3);
        
        let qty_val = qty.unwrap_or(0);

        // Seed base lines (session_id IS NULL)
        let base_report_id = format!("{}_base_{}", project_id, idx);
        let _ = qms_client.execute(
            "INSERT INTO packaging_project_reports (
                report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
             )
             VALUES ($1, NULL, $2, 'mpg', $3, NULL, $4, $5, $6, 0, 0, 0, $7, 0, 0, 0, 0, 0, 0, $7, 0, 0, 0.0, 0, 0, 0.0, 'v1.0', NOW())
             ON CONFLICT (report_id) DO NOTHING",
            &[&base_report_id, &project_id, &line_no, &item_id, &size_val, &(idx as i32), &qty_val]
        );

        // Seed INITIAL_PAK lines
        let pak_report_id = format!("{}_pak_{}", project_id, idx);
        let _ = qms_client.execute(
            "INSERT INTO packaging_project_reports (
                report_id, session_id, project_id, data_area_id, line_no, job_transaction_id,
                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                reject_washing, gramasi, btj, reject_bahan, session_qty, session_version, created_at
             )
             VALUES ($1, 'INITIAL_PAK', $2, 'mpg', $3, NULL, $4, $5, $6, 0, 0, 0, $7, 0, 0, 0, 0, 0, 0, $7, 0, 0, 0.0, 0, 0, 0.0, 'v1.0', NOW())
             ON CONFLICT (report_id) DO NOTHING",
            &[&pak_report_id, &project_id, &line_no, &item_id, &size_val, &(idx as i32), &qty_val]
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delete_proj() {
        let res = delete_packaging_project("non_existent");
        assert!(res.is_ok(), "delete_packaging_project failed: {:?}", res);
    }

    #[test]
    fn test_save_project_live() {
        let project = PackagingProject {
            project_id: "TEST_LIVE_DOWNLOAD_123".to_string(),
            plm_id: "PLM/26/01/00036".to_string(),
            brand: "Minimal".to_string(),
            season: "FALL-26".to_string(),
            article_name: "Minimal Viviene Blazer Black".to_string(),
            production_group: "MPG/PRG/2605/000192".to_string(),
            po_info: Some("PO_TEST".to_string()),
            po_qty: Some(100.0),
            po_plan_date: Some("2026-06-11".to_string()),
            po_vendor: Some("Vendor".to_string()),
            status: "downloaded".to_string(),
            cmt_cut_job_id: None,
            cmt_pak_job_id: None,
            sales_price: None,
            verified_doc: None,
            has_deduction: None,
            deduction_amount: None,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let res = save_packaging_project(project);
        println!("RESULT OF LIVE SAVE: {:?}", res);
        assert!(res.is_ok(), "Expected live save to succeed: {:?}", res);

        // Clean up mock project from database after verification to avoid leaking mock values into the active directory
        let delete_res = delete_packaging_project("TEST_LIVE_DOWNLOAD_123");
        assert!(delete_res.is_ok(), "Failed to clean up test project after test: {:?}", delete_res);
    }

    #[test]
    fn test_strict_job_requirement() {
        let project = PackagingProject {
            project_id: "TEST_STRICT_123".to_string(),
            plm_id: "PLM_NON_EXISTENT_999".to_string(),
            brand: "Brand".to_string(),
            season: "Season".to_string(),
            article_name: "Article".to_string(),
            production_group: "PG_NON_EXISTENT_999".to_string(),
            po_info: None,
            po_qty: None,
            po_plan_date: None,
            po_vendor: None,
            status: "downloaded".to_string(),
            cmt_cut_job_id: None,
            cmt_pak_job_id: None,
            sales_price: None,
            verified_doc: None,
            has_deduction: None,
            deduction_amount: None,
            created_at: "".to_string(),
            updated_at: "".to_string(),
        };

        let res = save_packaging_project(project);
        assert!(res.is_err(), "Expected save_packaging_project to fail when no jobs exist");
        let err = res.err().unwrap();
        assert!(err.contains("No active job transactions"), "Expected error message to mention No active job transactions, got: {}", err);
    }



    #[test]
    fn test_delete_cascade() {
        let mut client = get_connection_qms().unwrap();
        let pid = "TEST_PRJ_123";
        let sid = "TEST_SES_123";
        
        // Clean up first if exist
        let _ = client.execute("DELETE FROM packaging_projects WHERE project_id = $1", &[&pid]);
        
        // Insert project
        client.execute(
            "INSERT INTO packaging_projects (project_id, plm_id, brand, season, article_name, production_group, status) 
             VALUES ($1, 'PLM123', 'Brand', 'Season', 'Article', 'Group', 'downloaded')",
            &[&pid]
        ).unwrap();
        
        

        // Insert session
        client.execute(
            "INSERT INTO packaging_project_sessions (session_id, project_id, cycle_number, inspector_id, status) 
             VALUES ($1, $2, 1, 'Insp1', 'completed')",
            &[&sid, &pid]
        ).unwrap();

        // Insert report line
        client.execute(
            "INSERT INTO packaging_project_reports (report_id, session_id, project_id) VALUES ($1, $2, $3)",
            &[&format!("REP-{}", pid), &sid, &pid]
        ).unwrap();
        
        // Try to delete the project
        let delete_res = delete_packaging_project(pid);
        assert!(delete_res.is_ok(), "Cascade delete failed: {:?}", delete_res);
    }

}


