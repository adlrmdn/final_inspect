export interface AgentAction {
  type: 'navigate' | 'fill' | 'calculate' | 'status_alert';
  target?: string;
  data?: any;
}

export interface AgentResponse {
  reply: string;
  action?: AgentAction;
  thinking: string;
}

export class AIAgentService {
  private static instance: AIAgentService | null = null;

  private constructor() {}

  public static getInstance(): AIAgentService {
    if (!AIAgentService.instance) {
      AIAgentService.instance = new AIAgentService();
    }
    return AIAgentService.instance;
  }

  /**
   * Processes a natural language text command (typed or spoken)
   * and maps it to a UI action using a simulated offline SLM intent engine.
   */
  public processCommand(input: string): AgentResponse {
    const query = input.toLowerCase().trim();
    
    // Default Bahasa Indonesia reply
    let response: AgentResponse = {
      thinking: "Menganalisis token embedding... Pemetaan intent: CHAT_RESPONSE. Menyelesaikan respons percakapan secara lokal.",
      reply: "Saya siap membantu Anda. Coba perintah seperti 'Buka formulir kain', 'Isi batch BTC-101', 'Setel status nominal', atau bicaralah langsung kepada saya."
    };

    // NAVIGATE Intents (buka, go to, show, open, dll)
    if (query.includes('open') || query.includes('go to') || query.includes('show') || query.includes('buka') || query.includes('tampilkan') || query.includes('ke')) {
      if (query.includes('fabric') || query.includes('defect') || query.includes('roll') || query.includes('kain') || query.includes('rol') || query.includes('tekstil')) {
        response = {
          thinking: "Intent cocok: NAVIGASI. Parameter: fabric_v0. Mengarahkan viewport ke Formulir Kontrol Kualitas Kain.",
          reply: "Mengarahkan konsol ke template Kontrol Kualitas Kain...",
          action: { type: 'navigate', target: 'fabric_v0' }
        };
      } else if (query.includes('pack') || query.includes('box') || query.includes('shipping') || query.includes('kemas') || query.includes('kemasan') || query.includes('boks') || query.includes('dus') || query.includes('kotak')) {
        response = {
          thinking: "Intent cocok: NAVIGASI. Parameter: pack_v0. Mengarahkan viewport ke Formulir Kontrol Kualitas Pengemasan.",
          reply: "Mengarahkan konsol ke template Kontrol Kualitas Pengemasan...",
          action: { type: 'navigate', target: 'pack_v0' }
        };
      } else if (query.includes('dashboard') || query.includes('core') || query.includes('back') || query.includes('return') || query.includes('dasbor') || query.includes('utama') || query.includes('kembali')) {
        response = {
          thinking: "Intent cocok: NAVIGASI. Parameter: dashboard. Kembali ke Dasbor Kontrol Kualitas Utama.",
          reply: "Kembali ke konsol manajemen kualitas utama...",
          action: { type: 'navigate', target: 'dashboard' }
        };
      }
    }
    
    // FILL Intents (fill, set, input, isi, isikan, masukkan, setel, tulis)
    else if (query.includes('fill') || query.includes('set') || query.includes('input') || query.includes('write') || query.includes('isi') || query.includes('isikan') || query.includes('masukkan') || query.includes('setel') || query.includes('tulis') || query.includes('catat')) {
      const fillData: Record<string, any> = {};
      let matched = false;

      // Match status
      if (query.includes('nominal') || query.includes('pass') || query.includes('perfect') || query.includes('normal') || query.includes('baik') || query.includes('lulus')) {
        fillData.status = 'nominal';
        matched = true;
      } else if (query.includes('degraded') || query.includes('warning') || query.includes('variance') || query.includes('degradasi') || query.includes('peringatan') || query.includes('kurang')) {
        fillData.status = 'degraded';
        matched = true;
      } else if (query.includes('defect') || query.includes('critical') || query.includes('failed') || query.includes('fail') || query.includes('cacat') || query.includes('rusak') || query.includes('gagal')) {
        fillData.status = 'defect';
        matched = true;
      }

      // Match batch or ID patterns (e.g. btc-9812, pkg-502, btc-abc)
      const batchMatch = query.match(/(btc|pkg)-[0-9a-zA-Z]+/i);
      const generalBatchMatch = query.match(/(batch|id|material|lot)\s+([0-9a-zA-Z\-]+)/i);
      
      if (batchMatch) {
        fillData.batch_id = batchMatch[0].toUpperCase();
        matched = true;
      } else if (generalBatchMatch) {
        fillData.batch_id = generalBatchMatch[2].toUpperCase();
        matched = true;
      }

      // Match notes / observations
      const notesMatch = query.match(/(notes|note|observation|observe|observations|catatan|keterangan|catat)\s+(.*)$/i);
      if (notesMatch && notesMatch[2]) {
        fillData.notes = notesMatch[2];
        matched = true;
      }

      if (matched) {
        response = {
          thinking: `Intent cocok: UPDATE_FORM_STATE. Parameter diekstraksi: ${JSON.stringify(fillData)}. Menginjeksikan variabel ke konteks aktif secara offline.`,
          reply: `Berhasil memperbarui bidang formulir aktif: ${Object.keys(fillData).map(k => `[${k}: ${fillData[k]}]`).join(', ')}.`,
          action: { type: 'fill', data: fillData }
        };
      }
    }
    
    // CALCULATE Yield Intents (calculate, estimate, hitung, kalkulasi, estimasi, prediksi)
    else if (query.includes('calculate') || query.includes('estimate') || query.includes('yield') || query.includes('scrap') || query.includes('hitung') || query.includes('kalkulasi') || query.includes('estimasi') || query.includes('prediksi') || query.includes('cacat')) {
      const qtyMatch = query.match(/(\d+)\s+(defect|defect count|defects|cacat|rusak)/i);
      let count = 0;
      if (qtyMatch) {
        count = parseInt(qtyMatch[1]);
      } else {
        const simpleNum = query.match(/\b(\d+)\b/);
        if (simpleNum) count = parseInt(simpleNum[1]);
      }

      response = {
        thinking: `Intent cocok: YIELD_PREDICTION_CALCULATION. Parameter basis cacat: ${count}. Memulai estimasi regresi secara lokal.`,
        reply: `Mengestimasi hasil produksi (yield) untuk batch dengan ${count} cacat terdaftar. Hasil visualisasi ditampilkan secara real-time.`,
        action: { type: 'calculate', data: { defects: count } }
      };
    }

    return response;
  }
}
