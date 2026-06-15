# Quality Control System (QCS) - Standard Operating Procedure (SOP)
## Document Code: QCS-SOP-QC-001 | Version: 2.0 | Effective Date: June 15, 2026

---

## 1. PURPOSE & SCOPE
This Standard Operating Procedure (SOP) defines the mandatory steps for Quality Control (QC) inspectors executing packaging inspections on the Chimera QCS application. This workflow ensures style details, checklists, reject metrics, signed documentation, and deductions are accurately verified, locked, and synchronized with the central database and ERP systems.

---

## 2. STANDARD OPERATING WORKFLOW (STEP-BY-STEP)

```
[1. Search & Start] ➔ [2. Open Workspace] ➔ [3. Unlock Edit Mode] ➔ [4. Tick Checklist]
                                                                          │
[8. Revert Job]     魯 [7. Complete & Sync] ➔ [6. Upload Signature] ➔ [5. Log Defects]
(Correction Only)      (Auto-queue to RPA)     (Mandatory Verify)       (Add Photos)
```

### Step 1: Search and Download Style (Inisialisasi Artikel)
* **English**: Locate the top search input. Enter the style name or article code (e.g. `"Carmenta"` or `"Winter"`). Select the target style, then click the blue **Start Workspace** button to download the style's baseline data to your device.
* **Bahasa Indonesia**: Cari artikel di kolom pencarian atas. Masukkan nama atau kode artikel (misalnya `"Carmenta"` atau `"Winter"`). Pilih artikel yang sesuai, lalu klik tombol biru **Start Workspace** untuk mengunduh data dasar artikel ke perangkat Anda.

### Step 2: Open Workspace (Buka Ruang Kerja)
* **English**: Scroll to the **Active Packaging Workspaces** list. Locate your downloaded style card and click the green **Open** button to enter the active workspace.
* **Bahasa Indonesia**: Gulir ke daftar **Active Packaging Workspaces**. Cari kartu artikel yang sudah diunduh dan klik tombol hijau **Open** untuk masuk ke ruang kerja aktif.

### Step 3: Unlock Edit Mode (Buka Sesi Edit)
* **English**: By default, workspace fields are locked in read-only mode to prevent accidental inputs. Click the **Edit Version** button at the top header to unlock checklist items and quantity fields.
* **Bahasa Indonesia**: Secara bawaan, seluruh input ruang kerja terkunci (hanya-baca). Klik tombol **Edit Version** di header bagian atas untuk membuka kunci kolom checklist dan pengisian kuantitas.

### Step 4: Verify & Check Checklist Items (Centang Checklist Parameter)
* **English**: Thoroughly inspect the items physically. Tick the boxes on the screen as you verify each parameters: Wash check, Style details, Main Label, Fit Label, Printing/Embroidery Artwork, Hangtags, Barcodes, Packing List, and Shipping Mark.
* **Bahasa Indonesia**: Lakukan pemeriksaan fisik pakaian. Centang kotak di layar setelah Anda memverifikasi setiap parameter: Wash check, detail Style, Label Utama, Fit Label, Sablon/Bordir, Hangtag, Barcode, Packing List, dan Shipping Mark.

### Step 5: Input Inspection Quantities and Rejects (Isi Jumlah Produk & Reject)
* **English**: Click on individual size tabs (e.g., S, M, L) to input metrics:
  * **Inspected Qty**: The count of approved good garments.
  * **Rejects**: Enter quantities of defective items found under specific processes (cutting, sewing, finishing, washing, printing, embroidery, fabric quality).
  * *Note: If defect rates exceed the 1.0% AQL threshold or if there are lost garments (barang hilang), the system automatically calculates financial penalties (deductions) at a 30% discount on sales price.*
* **Bahasa Indonesia**: Klik pada tab ukuran (misalnya S, M, L) untuk memasukkan data:
  * **Inspected Qty**: Jumlah pakaian bagus yang disetujui.
  * **Rejects**: Masukkan jumlah pakaian reject yang ditemukan di bagian tertentu (potong, jahit, setrika, cuci, sablon, bordir, kualitas kain).
  * *Catatan: Jika jumlah reject melebihi batas 1.0% AQL atau terdapat barang hilang, sistem secara otomatis menghitung penalti keuangan (potongan) sebesar 30% dari harga jual.*

### Step 6: Log Quality Defects with Photos (Pencatatan Defect & Foto)
* **English**: For any defects, navigate to the right panel. Select the defect type (Sewing, Fabric, Packing), type a brief description, grade the severity (Major/Minor count), attach a photo, and click **Add Photo**.
* **Bahasa Indonesia**: Jika ditemukan cacat produk, gunakan panel sebelah kanan. Pilih tipe cacat (Jahit, Kain, Kemasan), ketik deskripsi singkat, tentukan tingkat keparahan (jumlah Mayor/Minor), lampirkan foto defect, lalu klik **Add Photo**.

### Step 7: Save Progress (Simpan Sesi Inspeksi)
* **English**: After completing data entries, click the **Save Version** button. This saves your changes locally and locks edit fields to secure the record.
* **Bahasa Indonesia**: Setelah selesai memasukkan data, klik tombol **Save Version**. Ini akan menyimpan data Anda secara lokal dan mengunci kolom input kembali agar aman.

### Step 8: Upload Signature and Verify (Unggah Tanda Tangan & Verifikasi)
* **English**: Capture or upload an image of the signed off-hand inspection sheet. Click **Verify** to validate. This is a mandatory step before completion.
* **Bahasa Indonesia**: Ambil foto atau unggah gambar lembar inspeksi yang sudah ditandatangani basah. Klik **Verify** untuk memvalidasi. Langkah ini wajib dilakukan sebelum menyelesaikan proyek.

### Step 9: Complete and Sync (Finalisasi & Sinkronisasi Otomatis)
* **English**: Click the **Complete & Sync** button (requires active network connection). This action:
  1. Locks the workspace permanently.
  2. Automatically pushes all inspection sessions and defect data to the central database.
  3. Automatically schedules processing jobs for the **Invoice RPA** and **Deduction RPA** in the centralized RPA database.
* **Bahasa Indonesia**: Klik tombol **Complete & Sync** (memerlukan koneksi internet aktif). Tindakan ini akan:
  1. Mengunci ruang kerja secara permanen.
  2. Mengirimkan seluruh riwayat sesi inspeksi dan data defect ke database pusat secara otomatis.
  3. Menjadwalkan antrean tugas untuk **RPA Invoice** dan **RPA Potongan** di database RPA pusat.

---

## 3. CORRECTIVE WORKFLOW: REVERTING COMPLETED PROJECTS
* **English**: If an inspector commits an entry mistake and needs to correct a completed project, they must click the **Revert** button (requires online mode). Confirming the warning will:
  1. Change the status back to `'downloaded'` (Draft), unlocking the workspace for editing.
  2. Automatically **delete pending RPA jobs** from the queue to prevent erroneous invoice generation.
* **Bahasa Indonesia**: Jika pemeriksa melakukan kesalahan input dan perlu mengoreksi proyek yang sudah selesai, mereka harus mengeklik tombol **Revert** (memerlukan koneksi internet). Konfirmasi peringatan akan:
  1. Mengembalikan status proyek menjadi `'downloaded'` (Draf), membuka kembali ruang kerja untuk pengeditan.
  2. Menghapus tugas antrean RPA yang masih tertunda dari database untuk mencegah pembuatan invoice yang salah.

---

## 4. KAIZEN AI ASSISTANT COMMAND REFERENCE

QC Inspectors can invoke system controls via voice or text prompts using the following formalized command structures:

| Target Action (EN) | Target Action (ID) | Sample AI Command Prefix |
| :--- | :--- | :--- |
| **Search Styles** | Cari Artikel | `"search basic"`, `"find winter"`, `"cari Carmenta"` |
| **Download Workspace** | Unduh Ruang Kerja | `"inspect Carmenta"`, `"unduh Carmenta"` |
| **Open Workspace** | Buka Workspace | `"open project Carmenta"`, `"buka proyek Carmenta"` |
| **Unlock Edit Mode** | Buka Kunci Edit | `"edit version"`, `"edit"`, `"ubah"` |
| **Toggle Checklist** | Centang Checklist | `"check wash"`, `"centang cuci"`, `"check wash waist tag shipping"` |
| **Set Quantity** | Isi Kuantitas | `"set size S quantity to 50"`, `"setel reject cutting size M ke 2"` |
| **Log Photo Defect** | Lapor Cacat | `"log defect sewing desc loose thread major 1"` |
| **Save Session** | Simpan Sesi | `"save version"`, `"simpan versi"`, `"simpan"` |
| **Verify Project** | Verifikasi Proyek | `"verify project"`, `"verifikasi"` |
| **Complete & Sync** | Selesaikan & Sinkron | `"complete project"`, `"complete and sync"`, `"selesaikan"` |
| **Print Report** | Cetak Laporan | `"print report"`, `"cetak laporan"`, `"laporan"` |
