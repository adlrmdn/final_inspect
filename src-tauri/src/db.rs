use postgres::{Client, NoTls};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use chrono::NaiveDateTime;

// PostgreSQL Database Connection URL configurations
const VSM_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/vsm";
const QMS_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/qms";
const POSTGRES_DB_URL: &str = "postgres://postgres:dsteam141@gateway-LB-0daa0ad89236a16a.elb.ap-southeast-3.amazonaws.com:5432/postgres";

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
    pub brand: String,
    pub season: String,
    pub article_name: String,
    pub production_group: String,
    pub po_info: Option<String>,
    pub po_qty: Option<f64>,
    pub po_plan_date: Option<String>,
    pub po_vendor: Option<String>,
    pub status: String,
    pub cmt_cut_job_id: Option<String>,
    pub cmt_pak_job_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// Struct representing a Packaging Project Session Report Row (JobTransactionLinesDetails mapped)
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingProjectReport {
    pub report_id: String,
    pub session_id: Option<String>,
    pub project_id: String,
    pub data_area_id: Option<String>,
    pub line_no: Option<i32>,
    pub job_transaction_id: Option<String>,
    pub item_id: Option<String>,
    pub size_val: Option<String>,
    pub global_display_order: Option<i32>,
    pub reject_produksi: Option<i32>,
    pub reject_finishing: Option<i32>,
    pub reject_embro: Option<i32>,
    pub qty_order: Option<i32>,
    pub total_qty_sample: Option<i32>,
    pub barang_hilang: Option<i32>,
    pub reject_cutting: Option<i32>,
    pub total_reject_qty: Option<i32>,
    pub reject_printing: Option<i32>,
    pub ref_rec_id: Option<i64>,
    pub total_good_qty: Option<i32>,
    pub reject_sewing: Option<i32>,
    pub reject_washing: Option<i32>,
    pub gramasi: Option<f64>,
    pub btj: Option<i32>,
    pub reject_bahan: Option<i32>,
    pub session_qty: f64,
    pub session_version: Option<String>,
    pub created_at: String,
}

// Struct representing a Packaging Project Session (QC Cycle with checklist & metrics)
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingProjectSession {
    pub session_id: String,
    pub project_id: String,
    pub cycle_number: i32,
    pub inspector_id: String,
    pub status: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    
    // Date fields
    pub inspection_date: Option<String>,
    
    // Checklist fields (Booleans)
    pub check_wash: bool,
    pub check_style_as_sample: bool,
    pub check_main_label: bool,
    pub check_flag_fit_label: bool,
    pub check_print_embro_artwork: bool,
    pub check_hangtag: bool,
    pub check_waist_tag: bool,
    pub check_barcode: bool,
    pub check_packing_list: bool,
    pub check_shipping_mark: bool,
    
    // Number fill int fields
    pub qty_available: i32,
    pub total_store: i32,
    pub store_inspected: i32,
    pub cutting_pcs: i32,
    pub sewing_pcs: i32,
    pub finishing_pcs: i32,
    pub packing_pcs: i32,
    pub sampling_pcs: i32,
    
    // Number fill float fields
    pub aql: f64,
    pub level_val: f64,
    
    // Text fields
    pub factory_representative: Option<String>,
    pub inspector: Option<String>,
    
    // Status fields
    pub version: Option<String>,
    pub result: Option<String>,
}

// Struct representing a Packaging Defect Image
#[derive(Debug, Serialize, Deserialize)]
pub struct PackagingDefectImage {
    pub image_id: String,
    pub project_id: String,
    pub session_id: Option<String>,
    pub image_path: String,
    pub defect_type: String,
    pub description: Option<String>,
    pub major: i32,
    pub minor: i32,
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

// Initialize tables inside QMS Database if they do not exist
pub fn init_tables() -> Result<(), String> {
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

    Ok(())
}

// Check QMS database connection health
pub fn check_connection() -> Result<(), String> {
    let _client = get_connection_qms()?;
    Ok(())
}

// Save or update a QC Template inside QMS (UPSERT)
pub fn save_template(template: QcTemplate) -> Result<(), String> {
    let _ = init_tables(); // Lazily ensure QMS schema exists
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
    let _ = init_tables();
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
    let _ = init_tables(); // Lazily ensure QMS schema exists
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
    let _ = init_tables();
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
        "SELECT pa.\"PLMId\", pa.\"Brand\", pa.\"Season\", pa.\"ArticleName\", pa.\"ProductionGroup\", 
                string_agg(DISTINCT ph.\"PurchaseOrderNumber\", ', ') AS \"PurchaseOrderNumber\",
                sum(pl.\"OrderedPurchaseQuantity\")::float8 AS \"OrderedQty\",
                substring(min(ph.\"RequestedDeliveryDate\") from 1 for 10) AS \"PlanDate\",
                string_agg(DISTINCT ph.\"PurchaseOrderName\", ', ') AS \"Vendor\"
         FROM plm_activity pa
         INNER JOIN po_lines pl ON pa.\"PLMId\" = pl.\"PLMId\" AND pl.\"LineDescription\" = 'Item Jasa CMT'
         INNER JOIN po_headers ph ON pl.\"PurchaseOrderNumber\" = ph.\"PurchaseOrderNumber\" AND ph.\"PurchPoolId\" = 'CMT'
         WHERE pa.\"PLMActivityStatus\" = 'Started' 
           AND pa.\"ProductionGroup\" IS NOT NULL
           AND pa.\"ProductionGroup\" != ''
           AND pa.\"PLMId\" NOT IN (SELECT \"PLMId\" FROM plm_activity_shadowing)
         GROUP BY pa.\"PLMId\", pa.\"Brand\", pa.\"Season\", pa.\"ArticleName\", pa.\"ProductionGroup\"
         ORDER BY pa.\"PLMId\" DESC", 
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

pub fn save_packaging_project(project: PackagingProject) -> Result<(), String> {
    let _ = init_tables();
    let mut client = get_connection_qms()?;
    
    let mut final_cut_job = project.cmt_cut_job_id.clone();
    let mut final_pak_job = project.cmt_pak_job_id.clone();

    // 1. Insert/upsert the project row first so foreign key constraints on details/lines succeed
    client.execute(
        "INSERT INTO packaging_projects (project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         ON CONFLICT (project_id)
         DO UPDATE SET plm_id = $2, brand = $3, season = $4, article_name = $5, production_group = $6, po_info = $7, po_qty = $8, po_plan_date = $9, po_vendor = $10, status = $11, cmt_cut_job_id = $12, cmt_pak_job_id = $13, updated_at = NOW()",
        &[
            &project.project_id,
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
        ],
    ).map_err(|e| format!("Failed to save packaging project: {}", e))?;

    // 2. Check if INITIAL_PAK lines are already present — if not, we must (re-)fetch from OData
    let initial_pak_count: i64 = client.query_one(
        "SELECT COUNT(*) FROM packaging_project_reports WHERE project_id = $1 AND session_id = 'INITIAL_PAK'",
        &[&project.project_id]
    ).map(|r| r.get(0)).unwrap_or(0);

    // Fetch from OData if: either job ID is unknown, OR INITIAL_PAK data has never been loaded
    if final_cut_job.is_none() || final_pak_job.is_none() || initial_pak_count == 0 {
        if let Ok((cut_job, pak_job)) = fetch_odata_jobs_and_lines(&project.project_id, &project.production_group) {
            if cut_job.is_some() {
                final_cut_job = cut_job;
            }
            if pak_job.is_some() {
                final_pak_job = pak_job;
            }
        }
    }

    // 3. If no job transactions exist, delete the created project row and error out
    if final_cut_job.is_none() && final_pak_job.is_none() {
        let _ = client.execute("DELETE FROM packaging_projects WHERE project_id = $1", &[&project.project_id]);
        return Err("No active job transactions (CMT-Cut or CMT-Pak) found for this production group in Microsoft Dynamics 365. Job transactions are required to start this style.".to_string());
    }

    // 4. Update the project row with the finalized job IDs
    client.execute(
        "UPDATE packaging_projects 
         SET cmt_cut_job_id = $1, cmt_pak_job_id = $2, updated_at = NOW()
         WHERE project_id = $3",
        &[&final_cut_job, &final_pak_job, &project.project_id]
    ).map_err(|e| format!("Failed to update packaging project job IDs: {}", e))?;

    // Seed Session 0 and Session 1 directly
    // 1. Calculate aggregated values from OData details stored in packaging_project_reports
    let mut total_order_qty = project.po_qty.unwrap_or(0.0) as i32;
    let mut cutting_pcs = total_order_qty;
    let mut packing_pcs = total_order_qty;
    
    // Query CMT-Cut lines (session_id IS NULL)
    if let Ok(rows) = client.query(
        "SELECT COALESCE(SUM(qty_order), 0)::int4, COALESCE(SUM(total_good_qty), 0)::int4 
         FROM packaging_project_reports 
         WHERE project_id = $1 AND session_id IS NULL",
        &[&project.project_id]
    ) {
        if let Some(row) = rows.first() {
            let order_sum: i32 = row.get(0);
            let good_sum: i32 = row.get(1);
            if order_sum > 0 {
                total_order_qty = order_sum;
            }
            if good_sum > 0 {
                cutting_pcs = good_sum;
            }
        }
    }

    // Query CMT-Pak lines (session_id = 'INITIAL_PAK')
    if let Ok(rows) = client.query(
        "SELECT COALESCE(SUM(total_good_qty), 0)::int4 
         FROM packaging_project_reports 
         WHERE project_id = $1 AND session_id = 'INITIAL_PAK'",
        &[&project.project_id]
    ) {
        if let Some(row) = rows.first() {
            let good_sum: i32 = row.get(0);
            if good_sum > 0 {
                packing_pcs = good_sum;
            }
        }
    }
    
    let sewing_pcs = cutting_pcs;
    let finishing_pcs = cutting_pcs;

    // 2. UPSERT Session 0 (Baseline)
    let session_0_id = format!("BASE-{}", project.project_id);
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
            &project.project_id,
            &total_order_qty,
            &cutting_pcs,
            &sewing_pcs,
            &finishing_pcs,
            &packing_pcs
        ]
    ).map_err(|e| format!("Failed to seed Session 0: {}", e))?;

    // 3. UPSERT Session 1 (Pre Final)
    let session_1_id = format!("SES-{}-1", project.project_id);
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
            &project.project_id,
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
        &[&project.project_id, &session_1_id]
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
                item_id, size_val, global_display_order, reject_produksi, reject_finishing,
                reject_embro, qty_order, total_qty_sample, barang_hilang, reject_cutting,
                total_reject_qty, reject_printing, ref_rec_id, total_good_qty, reject_sewing,
                reject_washing, gramasi, btj, reject_bahan, 0.0, 'v1.0', NOW()
             FROM packaging_project_reports
             WHERE project_id = $2 AND session_id = 'INITIAL_PAK'",
            &[&session_1_id, &project.project_id]
        ).map_err(|e| format!("Failed to duplicate INITIAL_PAK lines to Session 1: {}", e))?;
    }

    Ok(())
}

pub fn save_packaging_session(session: PackagingProjectSession) -> Result<(), String> {
    let _ = init_tables();
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

    client.execute(
        "INSERT INTO packaging_project_sessions (
            session_id, project_id, cycle_number, inspector_id, status, started_at, ended_at,
            inspection_date, check_wash, check_style_as_sample, check_main_label, check_flag_fit_label,
            check_print_embro_artwork, check_hangtag, check_waist_tag, check_barcode, check_packing_list,
            check_shipping_mark, qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs,
            finishing_pcs, packing_pcs, sampling_pcs, aql, level_val, factory_representative, inspector,
            version, result
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8 = '' THEN NULL ELSE $8::DATE END, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
         ON CONFLICT (session_id)
         DO UPDATE SET 
            cycle_number = $3, inspector_id = $4, status = $5, started_at = $6, ended_at = $7,
            inspection_date = CASE WHEN $8 = '' THEN NULL ELSE $8::DATE END, check_wash = $9, check_style_as_sample = $10,
            check_main_label = $11, check_flag_fit_label = $12, check_print_embro_artwork = $13, check_hangtag = $14,
            check_waist_tag = $15, check_barcode = $16, check_packing_list = $17, check_shipping_mark = $18,
            qty_available = $19, total_store = $20, store_inspected = $21, cutting_pcs = $22, sewing_pcs = $23,
            finishing_pcs = $24, packing_pcs = $25, sampling_pcs = $26, aql = $27, level_val = $28,
            factory_representative = $29, inspector = $30, version = $31, result = $32",
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
        ],
    ).map_err(|e| format!("Failed to save packaging session: {}", e))?;
    Ok(())
}

pub fn save_packaging_defect_image(image: PackagingDefectImage) -> Result<(), String> {
    let _ = init_tables();
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

pub fn get_packaging_projects() -> Result<Value, String> {
    let _ = init_tables();
    let mut client = get_connection_qms()?;
    
    let rows = client.query("SELECT project_id, plm_id, brand, season, article_name, production_group, po_info, po_qty, po_plan_date, po_vendor, status, cmt_cut_job_id, cmt_pak_job_id, created_at, updated_at FROM packaging_projects ORDER BY created_at DESC", &[])
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
        let created_at: NaiveDateTime = row.get(13);
        let updated_at: NaiveDateTime = row.get(14);

        let base_report = serde_json::Value::Null;

        // Fetch base lines (CMT-Cut OData rows)
        let base_lines_json = match get_packaging_project_reports(&project_id, None) {
            Ok(lines) => lines,
            Err(_) => serde_json::Value::Array(vec![]),
        };

        // 2. Fetch sessions for this project
        let session_rows = client.query(
            "SELECT session_id, cycle_number, inspector_id, status, started_at, ended_at, inspection_date,
                    check_wash, check_style_as_sample, check_main_label, check_flag_fit_label, check_print_embro_artwork,
                    check_hangtag, check_waist_tag, check_barcode, check_packing_list, check_shipping_mark,
                    qty_available, total_store, store_inspected, cutting_pcs, sewing_pcs, finishing_pcs, packing_pcs, sampling_pcs,
                    aql, level_val, factory_representative, inspector, version, result
             FROM packaging_project_sessions 
             WHERE project_id = $1 
             ORDER BY cycle_number ASC",
            &[&project_id]
        ).map_err(|e| format!("Failed to query sessions for {}: {}", project_id, e))?;

        let mut sessions = Vec::new();
        for s_row in session_rows {
            let session_id: String = s_row.get(0);
            let s_started: NaiveDateTime = s_row.get(4);
            let s_ended: Option<NaiveDateTime> = s_row.get(5);
            let s_inspect_date: Option<chrono::NaiveDate> = s_row.get(6);

            // Fetch session report lines (CMT-Pak lines for this session)
            let session_lines_json = match get_packaging_project_reports(&project_id, Some(&session_id)) {
                Ok(lines) => lines,
                Err(_) => serde_json::Value::Array(vec![]),
            };

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
                "qty_available": s_row.get::<_, i32>(17),
                "total_store": s_row.get::<_, i32>(18),
                "store_inspected": s_row.get::<_, i32>(19),
                "cutting_pcs": s_row.get::<_, i32>(20),
                "sewing_pcs": s_row.get::<_, i32>(21),
                "finishing_pcs": s_row.get::<_, i32>(22),
                "packing_pcs": s_row.get::<_, i32>(23),
                "sampling_pcs": s_row.get::<_, i32>(24),
                "aql": s_row.get::<_, f64>(25),
                "level_val": s_row.get::<_, f64>(26),
                "factory_representative": s_row.get::<_, Option<String>>(27),
                "inspector": s_row.get::<_, Option<String>>(28),
                "version": s_row.get::<_, Option<String>>(29),
                "result": s_row.get::<_, Option<String>>(30),
                "report_lines": session_lines_json
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
            "created_at": created_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "updated_at": updated_at.format("%Y-%m-%dT%H:%M:%S.000Z").to_string(),
            "base_report": base_report,
            "base_lines": base_lines_json,
            "sessions": sessions,
            "defect_images": defect_images
        }));
    }

    Ok(serde_json::Value::Array(projects))
}

pub fn delete_packaging_project(project_id: &str) -> Result<(), String> {
    let _ = init_tables();
    let mut client = get_connection_qms()?;
    
    // Manually delete child records first in order to support databases without cascade constraints
    client.execute("DELETE FROM packaging_project_reports WHERE project_id = $1", &[&project_id])
        .map_err(|e| format!("Failed to delete reports: {}", e))?;
        
    client.execute("DELETE FROM packaging_defect_images WHERE project_id = $1", &[&project_id])
        .map_err(|e| format!("Failed to delete defect images: {}", e))?;
        
    client.execute("DELETE FROM packaging_project_sessions WHERE project_id = $1", &[&project_id])
        .map_err(|e| format!("Failed to delete sessions: {}", e))?;
        
        
        
    client.execute("DELETE FROM packaging_projects WHERE project_id = $1", &[&project_id])
        .map_err(|e| format!("Failed to delete project: {}", e))?;
        
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
    let output = std::process::Command::new("curl")
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
    let output = std::process::Command::new("curl")
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

// Fetch CMT-Cut and CMT-Pak Job IDs and seed baseline and templates locally
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
    let mut pak_job_id = None;

    for rec in records {
        let op = rec["Operation"].as_str().unwrap_or("");
        let job_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
        if op == "CMT-Cut" {
            cut_job_id = job_id;
        } else if op == "CMT-Pak" {
            pak_job_id = job_id;
        }
    }

    println!("fetch_odata_jobs_and_lines: Found cut_job_id = {:?}, pak_job_id = {:?}", cut_job_id, pak_job_id);

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
    let filter_str = format!("JobTransactionId eq '{}'", job_id);
    let encoded_filter = percent_encode(&filter_str);
    let lines_url = format!("{}/data/JobTransactionLinesDetails?$filter={}", creds.resource, encoded_filter);

    let resp: serde_json::Value = call_curl_get(&lines_url, token)
        .map_err(|e| format!("Failed to call lines OData: {}", e))?;

    let records = resp["value"].as_array().ok_or_else(|| format!("Invalid response format for JobTransactionLinesDetails: {:?}", resp))?;

    println!("fetch_and_store_lines: Found {} lines for job {}", records.len(), job_id);

    for (idx, rec) in records.iter().enumerate() {
        let data_area_id = rec["dataAreaId"].as_str().map(|s| s.to_string());
        let line_no = rec["No"].as_i64().map(|n| n as i32);
        let job_transaction_id = rec["JobTransactionId"].as_str().map(|s| s.to_string());
        let item_id = rec["ItemId"].as_str().map(|s| s.to_string());
        let size_val = rec["Size"].as_str().map(|s| s.to_string());
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

        let report_id = format!("{}_{}_{}", project_id, job_id, idx);

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

    Ok(())
}

// Retrieve local packaging project report lines (either base/CMT-Cut or session/CMT-Pak lines)
pub fn get_packaging_project_reports(project_id: &str, session_id: Option<&str>) -> Result<Value, String> {
    let mut client = get_connection_qms()?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delete_proj() {
        let res = delete_packaging_project("non_existent");
        assert!(res.is_ok(), "delete_packaging_project failed: {:?}", res);
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
        ).unwrap();        // Try to delete the project
        let delete_res = delete_packaging_project(pid);
        assert!(delete_res.is_ok(), "Cascade delete failed: {:?}", delete_res);
    }
}
