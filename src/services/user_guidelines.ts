export interface GuidelineSection {
  titleEn: string;
  titleId: string;
  contentEn: string[];
  contentId: string[];
}

export const USER_GUIDELINES_SECTIONS: GuidelineSection[] = [
  {
    titleEn: "1. Select & Download Style",
    titleId: "1. Pilih & Unduh Artikel",
    contentEn: [
      "Type the name or code of the style you want to inspect (e.g. 'Carmenta' or 'Winter') in the top search box.",
      "Select the style from the dropdown list.",
      "Click the blue 'Start Workspace' button to download and initialize the project workspace on your device."
    ],
    contentId: [
      "Ketik nama atau kode artikel yang ingin Anda periksa (misalnya 'Carmenta' atau 'Winter') di kolom pencarian atas.",
      "Pilih artikel dari daftar hasil pencarian.",
      "Klik tombol biru 'Start Workspace' untuk mengunduh dan memulai ruang kerja proyek di perangkat Anda."
    ]
  },
  {
    titleEn: "2. Open Project & Start Editing",
    titleId: "2. Buka Proyek & Sesi Edit",
    contentEn: [
      "Scroll down to 'Active Packaging Workspaces' and click the 'Open' button on your style card.",
      "All fields are locked (read-only) by default. Click 'Edit Version' at the top to unlock inputs.",
      "Once edit mode is active, you can type quantities and check checklist boxes."
    ],
    contentId: [
      "Gulir ke bawah ke daftar 'Active Packaging Workspaces' dan klik tombol 'Open' pada kartu artikel Anda.",
      "Seluruh kolom terkunci secara bawaan. Klik 'Edit Version' di bagian atas untuk membuka kunci input data.",
      "Setelah mode edit aktif, Anda dapat mengetik kuantitas dan mencentang kotak checklist."
    ]
  },
  {
    titleEn: "3. Tick Checklist & Enter Quantities",
    titleId: "3. Centang Checklist & Isi Kuantitas",
    contentEn: [
      "Go to the Checklist section and tick verified items: Wash check, Style details, Main Label, Fit Label, printing/embroidery, Hangtags, Barcodes, Packing List, and Shipping Mark.",
      "Click on each size tab (e.g. S, M, L) to enter good pieces in 'Inspected Qty' and reject pieces in the respective reject boxes.",
      "Click 'Sync D365' in the production details header if you need to refresh baseline cutting templates from D365."
    ],
    contentId: [
      "Buka bagian Checklist dan centang item yang sudah diperiksa: Wash check, detail Style, Label Utama, Fit Label, sablon/bordir, Hangtag, Barcode, Packing List, dan Shipping Mark.",
      "Klik pada tab ukuran (misalnya S, M, L) untuk memasukkan jumlah pakaian bagus di kolom 'Inspected Qty' dan reject di kotak reject yang sesuai.",
      "Klik 'Sync D365' di header detail produksi jika Anda perlu memuat ulang total kuantitas potongan dasar terbaru dari D365."
    ]
  },
  {
    titleEn: "4. Capture Defect Photos",
    titleId: "4. Catat Cacat Foto",
    contentEn: [
      "If you find any quality issues, look at the right 'Photo Defect' panel.",
      "Select the defect type (e.g. Sewing, Fabric, Packing), type a brief description, specify the Major/Minor tally, and attach a photo.",
      "Click 'Add Photo' to log the defect record into the draft list."
    ],
    contentId: [
      "Jika Anda menemukan masalah kualitas, lihat panel kanan 'Photo Defect'.",
      "Pilih jenis cacat (misalnya jahit, kain, kemasan), ketik deskripsi singkat, tentukan jumlah Mayor/Minor, dan lampirkan foto.",
      "Klik 'Add Photo' untuk menyimpan catatan cacat ke daftar draf."
    ]
  },
  {
    titleEn: "5. Save Session & Next Cycle",
    titleId: "5. Simpan Sesi & Siklus Baru",
    contentEn: [
      "Click 'Save Version' at the top to save your progress and lock inputs to prevent accidental changes.",
      "If the inspection failed, click 'Move Version' to copy inspector details and quantities to start a new inspection version (e.g. Version 2.0)."
    ],
    contentId: [
      "Klik tombol 'Save Version' di bagian atas untuk menyimpan hasil kerja Anda dan mengunci input agar tidak terubah tidak sengaja.",
      "Jika inspeksi tidak lulus (Failed), klik 'Move Version' untuk menyalin detail pemeriksa dan jumlah produk guna memulai versi inspeksi baru (misalnya Versi 2.0)."
    ]
  },
  {
    titleEn: "6. Verify, Complete, & Sync",
    titleId: "6. Verifikasi, Selesai, & Sinkronkan",
    contentEn: [
      "Click 'Verify' to open the approval dialog. Enter the approver's email address and click Send — the system will email the inspection report PDF to the approver for digital signature review.",
      "All sessions in the project are locked for editing while any version is awaiting approval. The 'Confirmed By' and 'Approved By' boxes show 'Awaiting Approval' until signed.",
      "If the approver rejects the request, click 'Re-verify' to clear the rejection and send a new approval email.",
      "Once the approver signs digitally, the session status updates to Verified. Click 'Complete & Sync' (requires online) to lock the workspace, upload all sessions, and auto-schedule RPA invoice and deduction tasks.",
      "If a correction is needed after completing, click 'Revert' (requires online) to restore the project to Draft and delete any pending RPA queue tasks."
    ],
    contentId: [
      "Klik 'Verify' untuk membuka dialog persetujuan. Masukkan email penyetuju dan klik Kirim — sistem akan mengirim email laporan PDF inspeksi ke penyetuju untuk ditandatangani secara digital.",
      "Seluruh sesi dalam proyek terkunci saat ada versi yang sedang menunggu persetujuan. Kolom 'Confirmed By' dan 'Approved By' menampilkan 'Awaiting Approval' hingga ditandatangani.",
      "Jika penyetuju menolak permintaan, klik 'Re-verify' untuk membersihkan penolakan dan mengirim ulang email persetujuan.",
      "Setelah penyetuju menandatangani secara digital, status sesi berubah menjadi Verified. Klik 'Complete & Sync' (memerlukan internet) untuk mengunci ruang kerja, mengunggah seluruh sesi, dan menjadwalkan tugas RPA secara otomatis.",
      "Jika diperlukan koreksi setelah selesai, klik 'Revert' (memerlukan internet) untuk mengembalikan proyek ke status Draf dan menghapus tugas antrean RPA yang tertunda."
    ]
  },
  {
    titleEn: "7. Kaizen AI Assistant Commands",
    titleId: "7. Panduan Perintah Asisten AI Kaizen",
    contentEn: [
      "Find Styles: 'search basic', 'find winter', 'cari Carmenta'",
      "Download Style: 'inspect Carmenta', 'unduh Carmenta'",
      "Open Workspace: 'open project Carmenta', 'buka proyek Carmenta'",
      "Checklists (supports multi-task): 'check wash', 'centang cuci', 'check wash waist tag shipping'",
      "Inputs: 'set size S quantity to 50', 'setel reject cutting size M ke 2'",
      "Log Defect: 'log defect sewing desc loose thread major 1'",
      "Other controls: 'edit version', 'save version', 'start next version', 'verify project', 'complete project', 'sync project', 'print report'"
    ],
    contentId: [
      "Cari Artikel: 'search basic', 'find winter', 'cari Carmenta'",
      "Unduhan: 'inspect Carmenta', 'unduh Carmenta'",
      "Muka Workspace: 'open project Carmenta', 'buka proyek Carmenta'",
      "Checklist (mendukung multi-tugas): 'check wash', 'centang cuci', 'check wash waist tag shipping'",
      "Input data: 'set size S quantity to 50', 'setel reject cutting size M ke 2'",
      "Cacat: 'log defect sewing desc loose thread major 1'",
      "Kontrol lainnya: 'edit version', 'save version', 'start next version', 'verify project', 'complete project', 'sync project', 'print report'"
    ]
  }
];

export const USER_GUIDELINES_RAW_TEXT = `
Quality Control System (QCS) User Guidelines & Workflow:
- Select Style: Search and select a PLM style, click Start Workspace to download.
- Open Project: Click Open on active project cards to open the workspace.
- Edit Version: Click Edit Version to enable active inputs.
- Fill Data: Tick checklist items (Wash Check, Style, Main/Fit Labels, Artwork, Hangtag, Barcodes, Packing List, Shipping Mark). Input good quantity and production rejects per size.
- Refresh D365: Click Sync D365 in production details to refresh baseline cutting values.
- Log Defects: Attach defect photo, enter description, grade Major/Minor.
- Save: Click Save Version to save session.
- Move Version: Click Move Version to clone inspector and quantities to next cycle (e.g. Version 2.0).
- Verify: Click Verify, enter approver email, system sends PDF report for digital signature. All sessions lock while awaiting approval. Re-verify clears a rejection and resends.
- Complete & Sync: After digital approval, click Complete & Sync to lock workspace, sync all data, and queue RPA invoicing & deduction jobs.
- Revert: Click Revert to unlock a completed project back to draft and delete any pending RPA tasks.
- Assistant Commands (Multi-task checklist enabled): 'check wash waist tag shipping', 'set size S quantity to 50', 'log defect sewing desc loose thread major 1', 'edit version', 'save session', 'complete project'.
`;
