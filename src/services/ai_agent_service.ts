import { PackagingService } from './packaging_service';

export interface AgentAction {
  type: 'navigate' | 'fill' | 'calculate' | 'status_alert' | 'workflow_cmd';
  target?: string;
  command?: string;
  data?: any;
}

export interface AgentResponse {
  reply: string;
  action?: AgentAction;
  thinking: string;
}

// Standalone Levenshtein distance algorithm for character-level similarity
function levenshtein(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
}

// Normalized token-overlap similarity scoring engine
export function getFuzzyMatchScore(query: string, candidate: string): number {
  const qClean = query.toLowerCase()
    .replace(/(buka|project|proyek|open|the|untuk|style|cari|search|inspeksi|inspect|unduh|download|artikel|blazer|dress|pants|tshirt)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
    
  const qTokens = qClean.split(/\s+/).filter(t => t.length > 1);
  const cTokens = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(t => t.length > 1);
  if (qTokens.length === 0) return 0;
  
  let totalScore = 0;
  for (const q of qTokens) {
    let bestWordScore = 0;
    for (const c of cTokens) {
      let score = 0;
      if (c === q) {
        score = 1.0;
      } else if (c.startsWith(q)) {
        score = 0.9;
      } else if (c.includes(q) || q.includes(c)) {
        score = 0.8;
      } else {
        const maxLen = Math.max(q.length, c.length);
        const dist = levenshtein(q, c);
        score = (maxLen - dist) / maxLen;
      }
      if (score > bestWordScore) {
        bestWordScore = score;
      }
    }
    totalScore += bestWordScore;
  }
  return totalScore / qTokens.length;
}

const COLORS = ['beige', 'black', 'brown', 'navy', 'white', 'red', 'green', 'blue', 'yellow', 'grey', 'gray', 'orange', 'purple', 'pink', 'cream', 'olive', 'maroon', 'khaki', 'lilac', 'mint', 'charcoal', 'gold', 'silver', 'peach', 'coral', 'tan', 'mustard', 'teal', 'magenta', 'plum', 'rust', 'sand', 'stone', 'denim', 'camel', 'taupe', 'sage', 'lavender'];

// Standalone helper to parse style name and color from a string
function parseStyleAndColor(text: string): { style: string; color: string | null } {
  const words = text.toLowerCase()
    .replace(/(buka|project|proyek|open|the|untuk|style|cari|search|inspeksi|inspect|unduh|download|artikel|blazer|dress|pants|tshirt)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/);
  
  if (words.length === 0 || words[0] === '') {
    return { style: '', color: null };
  }

  let foundColor: string | null = null;
  const styleWords: string[] = [];
  
  for (const w of words) {
    if (COLORS.includes(w)) {
      foundColor = w;
    } else {
      styleWords.push(w);
    }
  }

  return {
    style: styleWords.join(' '),
    color: foundColor
  };
}

// Helper to normalize sizes with merged digits and slashes (e.g. s/73 -> s 73, m1 -> m 1)
function normalizeQueryForSizes(q: string): string {
  let normalized = q.toLowerCase().replace(/\//g, ' ');
  normalized = normalized.replace(/\b(xs|s|m|l|xl|2xl|3xl|xxl)(\d+)\b/gi, '$1 $2');
  return normalized;
}

export class AIAgentService {
  private static instance: AIAgentService | null = null;

  private lastAmbiguousStyle: { styleName: string; candidates: any[] } | null = null;
  public activeProjectId: string | null = null;

  private constructor() {}

  public static getInstance(): AIAgentService {
    if (!AIAgentService.instance) {
      AIAgentService.instance = new AIAgentService();
    }
    return AIAgentService.instance;
  }

  public setActiveProjectId(projectId: string | null) {
    this.activeProjectId = projectId;
  }

  /**
   * Processes a natural language text command (typed or spoken)
   * and maps it to a UI action using a simulated offline SLM intent engine.
   */
  public processCommand(input: string, currentView: 'dashboard' | 'form' = 'dashboard'): AgentResponse {
    const query = input.toLowerCase().trim();
    const isIndo = query.includes('buka') || query.includes('cari') || query.includes('unduh') || query.includes('centang') || query.includes('setel') || query.includes('cacat') || query.includes('simpan') || query.includes('selesaikan') || query.includes('cetak') || query.includes('bagaimana') || query.includes('status');
    const language = isIndo ? 'id' : 'en';

    const isWorkspaceActive = (currentView === 'form');

    // Context-aware disambiguation check
    if (this.lastAmbiguousStyle) {
      if (query.includes('cancel') || query.includes('batal')) {
        this.lastAmbiguousStyle = null;
        return {
          thinking: `Disambiguation cancelled by user.`,
          reply: language === 'id'
            ? "Pilihan warna dibatalkan."
            : "Color selection cancelled."
        };
      }

      const { candidates } = this.lastAmbiguousStyle;
      const parsed = parseStyleAndColor(query);
      const selectedColor = parsed.color || COLORS.find(col => query.includes(col));

      let match: any = null;
      if (selectedColor) {
        match = candidates.find(c => c.color === selectedColor);
      }

      if (!match) {
        for (const c of candidates) {
          if (query.includes(c.article_name.toLowerCase()) || getFuzzyMatchScore(query, c.article_name) > 0.7) {
            match = c;
            break;
          }
        }
      }

      if (match) {
        this.lastAmbiguousStyle = null; // Clear context after resolving
        if (match.source === 'local') {
          return {
            thinking: `Intent: DISAMBIGUATION_RESOLVED, match: "${match.article_name}" (local).`,
            reply: language === 'id'
              ? `Membuka workspace proyek **${match.article_name}**...`
              : `Opening workspace for project **${match.article_name}**...`,
            action: {
              type: 'workflow_cmd',
              command: 'open_project',
              data: { projectId: match.project_id }
            }
          };
        } else {
          const act = match.item;
          const isPoMissing = !act.po_info || act.po_info.trim() === '';
          if (isPoMissing) {
            return {
              thinking: `Intent: DISAMBIGUATION_RESOLVED, match: "${match.article_name}" but PO is missing.`,
              reply: language === 'id'
                ? `Gagal mengunduh: Artikel **${match.article_name}** tidak dapat dikonfigurasi karena PO CMT belum terdaftar.`
                : `Download failed: The style **${match.article_name}** cannot be configured because its CMT purchase order is not registered yet.`,
            };
          }
          return {
            thinking: `Intent: DISAMBIGUATION_RESOLVED, match: "${match.article_name}" (available).`,
            reply: language === 'id'
              ? `Artikel **${match.article_name}** belum aktif di direktori. Mengunduh workspace proyek...`
              : `Project **${match.article_name}** is not active locally. Downloading workspace...`,
            action: {
              type: 'workflow_cmd',
              command: 'download_project',
              data: { activity: match.item }
            }
          };
        }
      } else {
        // Clear state if the query is a completely different command
        this.lastAmbiguousStyle = null;
      }
    }

    const service = PackagingService.getInstance();
    const storedProjects = service.getStoredProjects();

    // Intent 4: SET INSPECTOR DETAILS / SETEL INSPEKTUR (Checked early to prioritize over project loading)
    if (
      query.includes('inspector') || query.includes('inspektur') || query.includes('pemeriksa') || 
      query.includes('confirmed by') || query.includes('representative') || query.includes('rekan pabrik') ||
      query.includes('inspected by') || query.includes('diinspeksi oleh')
    ) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: SET_INSPECTOR_DETAILS, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      const nameMatch = query.match(/(inspector|inspektur|pemeriksa|inspected by|diinspeksi oleh|confirmed by|representative|rekan pabrik|ke|jadi|to)\s+([a-zA-Z\s\.\-]+)/i);
      if (nameMatch && nameMatch[2]) {
        const parsedName = nameMatch[2].trim();
        const field = (query.includes('confirmed') || query.includes('representative') || query.includes('rekan')) ? 'factory_representative' : 'inspector';
        return {
          thinking: `Intent: SET_INSPECTOR_DETAILS, field: ${field}, name: ${parsedName}.`,
          reply: language === 'id'
            ? `Mengatur pemeriksa/pendamping ke "${parsedName}"...`
            : `Setting ${field === 'inspector' ? 'inspector' : 'factory rep'} name to "${parsedName}"...`,
          action: {
            type: 'workflow_cmd',
            command: 'set_inspector_details',
            data: { field, name: parsedName }
          }
        };
      }
    }

    // Early declaration of isProjectLoadingIntent helper
    const isProjectLoadingIntent = (
      query.includes('open') ||
      query.includes('select') ||
      query.includes('go to') ||
      query.includes('buka') ||
      query.includes('pilih') ||
      query.includes('masuk') ||
      query.includes('download') ||
      query.includes('inspect') ||
      query.includes('unduh') ||
      query.includes('inspeksi') ||
      query.includes('mulai')
    );

    // RAG QA Queries (Statistik, Status, Kriteria, Help, Guide)
    const isRagQuery = (
      query.includes('status') || query.includes('bagaimana') || query.includes('list') || 
      query.includes('daftar') || query.includes('summary') || query.includes('review') || 
      query.includes('jumlah') || query.includes('total') || query.includes('laporan') ||
      query.includes('how') || query.includes('guide') || query.includes('help') || 
      query.includes('panduan') || query.includes('bantuan') || query.includes('petunjuk') ||
      query.includes('rule') || query.includes('aturan') || query.includes('syarat') ||
      query.includes('inspeksi') || query.includes('denda') || query.includes('penalti') ||
      query.includes('reject') || query.includes('loss') || query.includes('hilang') ||
      query.includes('cacat') || query.includes('defect')
    );

    if (isRagQuery && !isProjectLoadingIntent) {
      // If it doesn't match an immediate action command, handle it as RAG
      if (!query.includes('set') && !query.includes('change') && !query.includes('setel') && !query.includes('ganti') && !query.includes('buka') && !query.includes('open') && !query.includes('unduh') && !query.includes('download')) {
        return this.handleRAGQuery(query, language, storedProjects);
      }
    }

    // Intent 1: SEARCH STYLES / CARI ARTIKEL
    if (query.includes('search') || query.includes('find') || query.includes('look for') || query.includes('cari') || query.includes('temukan')) {
      const cleanSearch = query.replace(/(search|find|look for|style|artikel|cari|temukan|untuk)/gi, '').trim();
      return {
        thinking: `Intent: SEARCH_STYLES, query: ${cleanSearch}. Resolving search filter.`,
        reply: language === 'id'
          ? `Mencari artikel dengan kata kunci "${cleanSearch}"...`
          : `Searching for styles with keyword "${cleanSearch}"...`,
        action: {
          type: 'workflow_cmd',
          command: 'search_styles',
          data: { query: cleanSearch }
        }
      };
    }

    if (isProjectLoadingIntent) {
      const queryParsed = parseStyleAndColor(query);

      if (queryParsed.style !== '') {
        interface Candidate {
          item: any;
          source: 'local' | 'available';
          article_name: string;
          project_id?: string;
          style: string;
          color: string | null;
          styleScore: number;
        }

        const candidates: Candidate[] = [];

        // 1. Scan locally stored projects
        for (const p of storedProjects) {
          const candParsed = parseStyleAndColor(p.article_name);
          const score = getFuzzyMatchScore(queryParsed.style, candParsed.style);
          if (score > 0.4) {
            candidates.push({
              item: p,
              source: 'local',
              article_name: p.article_name,
              project_id: p.project_id,
              style: candParsed.style,
              color: candParsed.color,
              styleScore: score
            });
          }
        }

        // 2. Scan available PLM activities
        let activities: any[] = [];
        try {
          const listStr = localStorage.getItem('packaging_plm_activities');
          if (listStr) activities = JSON.parse(listStr);
        } catch (e) {}

        for (const act of activities) {
          const candParsed = parseStyleAndColor(act.article_name);
          const score = getFuzzyMatchScore(queryParsed.style, candParsed.style);
          if (score > 0.4) {
            // Avoid duplicate additions if already matched locally with exact style and color
            const existsLocally = candidates.some(
              c => c.source === 'local' && c.style === candParsed.style && c.color === candParsed.color
            );
            if (!existsLocally) {
              candidates.push({
                item: act,
                source: 'available',
                article_name: act.article_name,
                style: candParsed.style,
                color: candParsed.color,
                styleScore: score
              });
            }
          }
        }

        // Determine best style score
        const maxStyleScore = candidates.length > 0 ? Math.max(...candidates.map(c => c.styleScore)) : 0;

        if (maxStyleScore < 0.4) {
          // If not in active project AND not in available PLM list, return unavailable
          return {
            thinking: `Intent: PROJECT_LOADING, query style: "${queryParsed.style}". No matching style found in local or PLM lists (max score: ${maxStyleScore}).`,
            reply: language === 'id'
              ? `Maaf, artikel "${queryParsed.style}" tidak tersedia di direktori lokal maupun daftar PLM.`
              : `Sorry, style "${queryParsed.style}" is not available in the local project list or the PLM directory.`,
          };
        }

        // Keep candidates matching the best style score (within small margin)
        const bestStyleCandidates = candidates.filter(c => c.styleScore >= maxStyleScore - 0.05);

        // Disambiguate or select match
        let uniqueMatch: Candidate | null = null;
        let multipleColorsResponse: AgentResponse | null = null;

        if (queryParsed.color !== null) {
          // Case A: User specified a color in their query
          const colorMatched = bestStyleCandidates.filter(c => c.color === queryParsed.color);
          if (colorMatched.length === 1) {
            uniqueMatch = colorMatched[0];
          } else if (colorMatched.length > 1) {
            uniqueMatch = colorMatched[0];
          } else {
            // Style matched but not in the requested color. Present options.
            const uniqueColors = Array.from(new Set(bestStyleCandidates.map(c => c.color).filter((col): col is string => !!col)));
            const capitalizedColors = uniqueColors.map(col => col.charAt(0).toUpperCase() + col.slice(1));
            const colorsList = capitalizedColors.join(', ');
            const displayStyle = bestStyleCandidates[0].article_name.replace(new RegExp(`\\s+${bestStyleCandidates[0].color}$`, 'i'), '');

            multipleColorsResponse = {
              thinking: `Intent: PROJECT_LOADING, query style: "${queryParsed.style}" found but color "${queryParsed.color}" mismatch. Presenting colors.`,
              reply: language === 'id'
                ? `Artikel **${displayStyle}** tidak tersedia dalam warna **${queryParsed.color}**. Warna yang tersedia: **${colorsList}**.`
                : `Style **${displayStyle}** is not available in color **${queryParsed.color}**. Available colors: **${colorsList}**.`,
            };
            this.lastAmbiguousStyle = {
              styleName: displayStyle,
              candidates: bestStyleCandidates
            };
          }
        } else {
          // Case B: User did NOT specify a color in their query
          if (bestStyleCandidates.length === 1) {
            uniqueMatch = bestStyleCandidates[0];
          } else {
            // There are multiple colors for this style! Offer options.
            const uniqueColors = Array.from(new Set(bestStyleCandidates.map(c => c.color).filter((col): col is string => !!col)));
            const capitalizedColors = uniqueColors.map(col => col.charAt(0).toUpperCase() + col.slice(1));
            const colorsList = capitalizedColors.join(', ');
            const displayStyle = bestStyleCandidates[0].article_name.replace(new RegExp(`\\s+${bestStyleCandidates[0].color}$`, 'i'), '');

            multipleColorsResponse = {
              thinking: `Intent: PROJECT_LOADING, query style: "${queryParsed.style}" matched multiple colors: [${colorsList}]. Asking for color clarification.`,
              reply: language === 'id'
                ? `Artikel **${displayStyle}** memiliki beberapa warna tersedia: **${colorsList}**. Silakan tentukan warna yang ingin dibuka.`
                : `Style **${displayStyle}** is available in multiple colors: **${colorsList}**. Please specify which color you want.`,
            };
            this.lastAmbiguousStyle = {
              styleName: displayStyle,
              candidates: bestStyleCandidates
            };
          }
        }

        // If we found a unique match, proceed to execute opening/downloading action
        if (uniqueMatch) {
          if (uniqueMatch.source === 'local') {
            return {
              thinking: `Intent: OPEN_PROJECT, match: "${uniqueMatch.article_name}" (local, style score: ${uniqueMatch.styleScore}).`,
              reply: language === 'id'
                ? `Membuka workspace proyek **${uniqueMatch.article_name}**...`
                : `Opening workspace for project **${uniqueMatch.article_name}**...`,
              action: {
                type: 'workflow_cmd',
                command: 'open_project',
                data: { projectId: uniqueMatch.project_id }
              }
            };
          } else {
            const act = uniqueMatch.item;
            const isPoMissing = !act.po_info || act.po_info.trim() === '';
            if (isPoMissing) {
              return {
                thinking: `Intent: DOWNLOAD_PROJECT, match: "${uniqueMatch.article_name}" but PO is missing.`,
                reply: language === 'id'
                  ? `Gagal mengunduh: Artikel **${uniqueMatch.article_name}** tidak dapat dikonfigurasi karena PO CMT belum terdaftar.`
                  : `Download failed: The style **${uniqueMatch.article_name}** cannot be configured because its CMT purchase order is not registered yet.`,
              };
            }

            return {
              thinking: `Intent: DOWNLOAD_PROJECT, match: "${uniqueMatch.article_name}" (available, style score: ${uniqueMatch.styleScore}).`,
              reply: language === 'id'
                ? `Artikel **${uniqueMatch.article_name}** belum aktif di direktori. Mengunduh workspace proyek...`
                : `Project **${uniqueMatch.article_name}** is not active locally. Downloading workspace...`,
              action: {
                type: 'workflow_cmd',
                command: 'download_project',
                data: { activity: uniqueMatch.item }
              }
            };
          }
        }

        if (multipleColorsResponse) {
          return multipleColorsResponse;
        }
      }
    }

    // Intent: UPDATE WORKSPACE DATA (AQL, LEVEL, SAMPLING, PRODUCTION STATUS, SIZES, CHECKLISTS)
    const normalizedUpdateQuery = normalizeQueryForSizes(query);
    const tokens = normalizedUpdateQuery.split(/\s+/);

    let aql: number | undefined;
    let level_val: number | undefined;
    let sampling_pcs: number | undefined;
    let cutting_pcs: number | undefined;
    let sewing_pcs: number | undefined;
    let finishing_pcs: number | undefined;
    let packing_pcs: number | undefined;
    let result: 'Passed' | 'Failed' | undefined;

    const aqlMatch = query.match(/aql\s*([\d\.]+)/);
    if (aqlMatch) aql = parseFloat(aqlMatch[1]);

    const levelMatch = query.match(/(?:level|lvl)\s*(\d+)/);
    if (levelMatch) level_val = parseInt(levelMatch[1], 10);

    const samplingMatch = query.match(/(?:sampling|sample)\s*(\d+)/);
    if (samplingMatch) sampling_pcs = parseInt(samplingMatch[1], 10);

    const cuttingMatch = query.match(/cutting\s*(\d+)/);
    if (cuttingMatch) cutting_pcs = parseInt(cuttingMatch[1], 10);

    const sewingMatch = query.match(/sewing\s*(\d+)/);
    if (sewingMatch) sewing_pcs = parseInt(sewingMatch[1], 10);

    const finishingMatch = query.match(/finishing\s*(\d+)/);
    if (finishingMatch) finishing_pcs = parseInt(finishingMatch[1], 10);

    const packingMatch = query.match(/packing\s*(\d+)/);
    if (packingMatch) packing_pcs = parseInt(packingMatch[1], 10);

    if (query === 'pass' || query === 'passed' || query === 'lulus' || query.includes('status passed') || query.includes('status to passed') || query.includes('inspection status to passed')) {
      result = 'Passed';
    } else if (query === 'fail' || query === 'failed' || query === 'gagal' || query.includes('status failed') || query.includes('status to failed')) {
      result = 'Failed';
    }

    const SIZES = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', 'xxl'];
    const FIELD_KEYWORDS = [
      { key: 'reject_cutting', keywords: ['cutting', 'potong'] },
      { key: 'reject_sewing', keywords: ['sewing', 'jahit'] },
      { key: 'reject_finishing', keywords: ['finishing', 'setrika'] },
      { key: 'reject_washing', keywords: ['washing', 'cuci'] },
      { key: 'reject_printing', keywords: ['printing', 'sablon'] },
      { key: 'reject_embro', keywords: ['embro', 'bordir'] },
      { key: 'reject_bahan', keywords: ['bahan', 'material', 'fabric', 'rijek bahan', 'reject bahan'] },
      { key: 'btj', keywords: ['btj'] },
      { key: 'barang_hilang', keywords: ['hilang', 'lost', 'missing', 'barang hilang', 'lost garments'] },
      { key: 'session_qty', keywords: ['good', 'bagus', 'qty', 'quantity', 'version', 'inspeksi', 'pcs'] }
    ];

    function matchFieldKeyword(toks: string[], idx: number): { key: string; consumed: number } | null {
      const t1 = toks[idx];
      const t2 = toks[idx + 1] || '';
      const twoWords = `${t1} ${t2}`;

      for (const fk of FIELD_KEYWORDS) {
        for (const kw of fk.keywords) {
          if (kw === twoWords) {
            return { key: fk.key, consumed: 2 };
          }
        }
      }

      for (const fk of FIELD_KEYWORDS) {
        for (const kw of fk.keywords) {
          if (kw === t1) {
            return { key: fk.key, consumed: 1 };
          }
        }
      }

      return null;
    }

    let sizeQuantities: Array<{ size: string; field: string; value: number }> = [];
    let currentSize: string | null = null;
    let currentField: string | null = null;
    let tokenIndex = 0;

    while (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex];

      const fieldMatch = matchFieldKeyword(tokens, tokenIndex);
      if (fieldMatch) {
        currentField = fieldMatch.key;
        tokenIndex += fieldMatch.consumed;
        continue;
      }

      const isSize = SIZES.includes(token);
      if (isSize) {
        currentSize = token.toUpperCase();
        tokenIndex++;
        continue;
      }

      const isTotalKeyword = ['ttl', 'total', 'jumlah'].includes(token);
      if (isTotalKeyword) {
        currentSize = null;
        tokenIndex++;
        continue;
      }

      const numVal = parseInt(token, 10);
      if (!isNaN(numVal)) {
        const fieldToUse = currentField || 'session_qty';
        if (currentSize) {
          sizeQuantities.push({
            size: currentSize,
            field: fieldToUse,
            value: numVal
          });
        }
        tokenIndex++;
        continue;
      }

      tokenIndex++;
    }

    const checkWash = query.includes('wash') || query.includes('cuci');
    const checkSample = query.includes('sample') || query.includes('sampel');
    const checkMainLabel = query.includes('main label') || query.includes('label utama');
    const checkFitLabel = query.includes('fit label') || query.includes('flag label') || query.includes('fit');
    const checkPrintEmbro = query.includes('print') || query.includes('embro') || query.includes('artwork') || query.includes('gambar') || query.includes('bordir') || query.includes('sablon');
    const checkHangtag = query.includes('hangtag');
    const checkWaistTag = query.includes('waist tag') || query.includes('waisttag');
    const checkBarcode = query.includes('barcode') || query.includes('barkod');
    const checkPackingList = query.includes('packing list') || query.includes('packinglist');
    const checkShippingMark = query.includes('shipping mark') || query.includes('shippingmark') || query.includes('shipping');

    const isCheckCommand = query.includes('check') || query.includes('uncheck') || query.includes('centang') || query.includes('hilangkan centang') || query.includes('aktifkan') || query.includes('matikan');
    const fields: string[] = [];
    if (isCheckCommand) {
      if (checkWash) fields.push('check_wash');
      if (checkSample) fields.push('check_style_as_sample');
      if (checkMainLabel) fields.push('check_main_label');
      if (checkFitLabel) fields.push('check_flag_fit_label');
      if (checkPrintEmbro) fields.push('check_print_embro_artwork');
      if (checkHangtag) fields.push('check_hangtag');
      if (checkWaistTag) fields.push('check_waist_tag');
      if (checkBarcode) fields.push('check_barcode');
      if (checkPackingList) fields.push('check_packing_list');
      if (checkShippingMark) fields.push('check_shipping_mark');
    }

    const isChecked = !(query.includes('uncheck') || query.includes('hilangkan') || query.includes('matikan'));

    const hasUpdate = (
      aql !== undefined ||
      level_val !== undefined ||
      sampling_pcs !== undefined ||
      cutting_pcs !== undefined ||
      sewing_pcs !== undefined ||
      finishing_pcs !== undefined ||
      packing_pcs !== undefined ||
      result !== undefined ||
      sizeQuantities.length > 0 ||
      fields.length > 0
    );

    if (hasUpdate) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Workspace update requested, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }

      const details: string[] = [];
      if (aql !== undefined) details.push(`AQL: ${aql}`);
      if (level_val !== undefined) details.push(`Level: ${level_val}`);
      if (sampling_pcs !== undefined) details.push(`Sampling: ${sampling_pcs} pcs`);
      if (cutting_pcs !== undefined) details.push(`Cutting: ${cutting_pcs} pcs`);
      if (sewing_pcs !== undefined) details.push(`Sewing: ${sewing_pcs} pcs`);
      if (finishing_pcs !== undefined) details.push(`Finishing: ${finishing_pcs} pcs`);
      if (packing_pcs !== undefined) details.push(`Packing: ${packing_pcs} pcs`);
      if (result !== undefined) details.push(`Result: ${result}`);
      for (const sq of sizeQuantities) {
        details.push(`Size ${sq.size} ${sq.field.replace(/_/g, ' ')}: ${sq.value}`);
      }
      if (fields.length > 0) {
        details.push(`Checklists: ${fields.map(f => f.replace('check_', '').replace(/_/g, ' ')).join(', ')} -> ${isChecked ? 'Checked' : 'Unchecked'}`);
      }

      const replyText = language === 'id'
        ? `Memperbarui data workspace QC:\n${details.map(d => `- ${d}`).join('\n')}`
        : `Updating QC workspace data:\n${details.map(d => `- ${d}`).join('\n')}`;

      return {
        thinking: `Intent: UPDATE_WORKSPACE_DATA. Parsed updates: ${JSON.stringify({ aql, level_val, sampling_pcs, cutting_pcs, sewing_pcs, finishing_pcs, packing_pcs, result, sizeQuantities, fields, isChecked })}.`,
        reply: replyText,
        action: {
          type: 'workflow_cmd',
          command: 'update_workspace_data',
          data: {
            aql,
            level_val,
            sampling_pcs,
            cutting_pcs,
            sewing_pcs,
            finishing_pcs,
            packing_pcs,
            result,
            sizeQuantities,
            fields,
            value: isChecked
          }
        }
      };
    }




    // Intent 7: LOG DEFECT / TAMBAH CACAT DEFECT PHOTO
    // Pattern: "log defect Sewing description loose thread major 1 minor 0"
    if (query.includes('log defect') || query.includes('defect') || query.includes('cacat') || query.includes('cacat baru') || query.includes('foto cacat')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: LOG_DEFECT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      let typeInput = 'Sewing';
      if (query.includes('labeling') || query.includes('label')) typeInput = 'Labeling';
      else if (query.includes('packing') || query.includes('kemasan')) typeInput = 'Packing';
      else if (query.includes('fabric') || query.includes('kain')) typeInput = 'Fabric';
      else if (query.includes('artwork') || query.includes('sablon') || query.includes('bordir')) typeInput = 'Artwork';
      else if (query.includes('other') || query.includes('lain')) typeInput = 'Other';

      const descMatch = query.match(/(desc|description|keterangan|keterangan:|keterangan|desc:)\s+([a-zA-Z\s0-9\-_]+)/i);
      const descVal = descMatch ? descMatch[2].trim() : 'Defect logged via Kaizen Assistant';

      const majMatch = query.match(/(major|maj|mayor)\s+(\d+)/i);
      const minMatch = query.match(/(minor|min)\s+(\d+)/i);
      const majorVal = majMatch ? parseInt(majMatch[2], 10) : 0;
      const minorVal = minMatch ? parseInt(minMatch[2], 10) : 0;

      return {
        thinking: `Intent: LOG_DEFECT, type: ${typeInput}, desc: ${descVal}, major: ${majorVal}, minor: ${minorVal}.`,
        reply: language === 'id'
          ? `Mencatat cacat foto baru: Tipe **${typeInput}**, Deskripsi: "${descVal}", Major: ${majorVal}, Minor: ${minorVal}...`
          : `Logging new defect photo: Type **${typeInput}**, Description: "${descVal}", Major: ${majorVal}, Minor: ${minorVal}...`,
        action: {
          type: 'workflow_cmd',
          command: 'log_defect',
          data: {
            type: typeInput,
            description: descVal,
            major: majorVal,
            minor: minorVal,
            image_path: 'attached_via_chat.png'
          }
        }
      };
    }

    // Intent 7b: EDIT VERSION / EDIT SESSION / EDIT / UBAH / EDIT VERSI
    if (query.includes('edit version') || query.includes('edit session') || query.includes('edit') || query.includes('ubah versi') || query.includes('ubah sesi') || query.includes('mulai ubah') || query.includes('edit versi')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: EDIT_VERSION, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: EDIT_VERSION.`,
        reply: language === 'id'
          ? "Mengaktifkan mode pengeditan untuk versi inspeksi aktif..."
          : "Enabling edit mode for the active inspection version...",
        action: {
          type: 'workflow_cmd',
          command: 'edit_version'
        }
      };
    }

    // Intent 7c: CANCEL EDIT / DISCARD EDIT / CANCEL / BATAL
    if (query.includes('cancel edit') || query.includes('discard edit') || query.includes('cancel') || query.includes('batal edit') || query.includes('batal') || query.includes('read only') || query.includes('baca saja')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: CANCEL_EDIT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: CANCEL_EDIT.`,
        reply: language === 'id'
          ? "Membatalkan perubahan dan kembali ke mode baca saja..."
          : "Canceling edits and returning to read-only mode...",
        action: {
          type: 'workflow_cmd',
          command: 'cancel_edit'
        }
      };
    }

    // Intent 8: SAVE SESSION / SIMPAN VERSI / SELESAI INSPEKSI
    if (query.includes('save session') || query.includes('save version') || query.includes('save') || query.includes('simpan versi') || query.includes('simpan sesi') || query.includes('simpan')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: SAVE_SESSION, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: SAVE_SESSION.`,
        reply: language === 'id'
          ? "Menyimpan versi inspeksi aktif..."
          : "Saving active inspection version and logging defect records...",
        action: {
          type: 'workflow_cmd',
          command: 'save_session'
        }
      };
    }

    // Intent 9: START NEXT VERSION / SIKLUS BARU / VERSI BERIKUTNYA
    if (
      query === 'next' || query === 'next version' || query === 'next ver' ||
      query.includes('start next version') || query.includes('start version') || 
      query.includes('move version') || query.includes('next cycle') || 
      query.includes('mulai versi') || query.includes('siklus baru') || 
      query.includes('versi baru') || query.includes('versi berikutnya') || 
      query.includes('versi berikut') || query.includes('siklus berikutnya')
    ) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: START_NEXT_VERSION, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: START_NEXT_VERSION.`,
        reply: language === 'id'
          ? "Memulai kloning ke versi inspeksi berikutnya..."
          : "Initializing / cloning to the next inspection version cycle...",
        action: {
          type: 'workflow_cmd',
          command: 'move_version'
        }
      };
    }

    // Intent 10: VERIFY PROJECT / VERIFIKASI PROYEK
    if (query.includes('verify') || query.includes('upload verification') || query.includes('verifikasi')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: VERIFY_PROJECT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: VERIFY_PROJECT.`,
        reply: language === 'id'
          ? "Mengunggah dokumen verifikasi bertanda tangan dan memverifikasi proyek..."
          : "Uploading signed verification document and setting project verified status...",
        action: {
          type: 'workflow_cmd',
          command: 'verify_project'
        }
      };
    }

    // Intent 11: COMPLETE PROJECT / SELESAIKAN PROYEK
    if (query.includes('complete project') || query.includes('complete') || query.includes('selesaikan proyek') || query.includes('selesaikan') || query.includes('kunci')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: COMPLETE_PROJECT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: COMPLETE_PROJECT.`,
        reply: language === 'id'
          ? "Menandai proyek QC pengemasan aktif sebagai SELESAI..."
          : "Marking active packaging QC project as COMPLETED...",
        action: {
          type: 'workflow_cmd',
          command: 'complete_project'
        }
      };
    }

    // Intent 12: SYNC PROJECT / SINKRONISASI
    if (query.includes('sync') || query.includes('synchronize') || query.includes('sinkronisasi') || query.includes('sinkron')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: SYNC_PROJECT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: SYNC_PROJECT.`,
        reply: language === 'id'
          ? "Sinkronisasi data QC ke server pusat..."
          : "Synchronizing project and session QC logs to cloud central server...",
        action: {
          type: 'workflow_cmd',
          command: 'sync_project'
        }
      };
    }

    // Intent 13: PRINT REPORT / CETAK LAPORAN
    if (query.includes('print') || query.includes('cetak') || query.includes('report') || query.includes('laporan')) {
      if (!isWorkspaceActive) {
        return {
          thinking: `Intent: PRINT_REPORT, but workspace is not active.`,
          reply: language === 'id'
            ? "Gagal mengeksekusi perintah: Saluran kontrol alur kerja tidak aktif. Silakan buka proyek QC terlebih dahulu."
            : "Failed to execute: The workflow control channel is currently offline. Please open an inspection project first."
        };
      }
      return {
        thinking: `Intent: PRINT_REPORT.`,
        reply: language === 'id'
          ? "Membuka dialog cetak laporan..."
          : "Opening native print dialog for landscape A4 report...",
        action: {
          type: 'workflow_cmd',
          command: 'print_report'
        }
      };
    }

    // General fallback
    return {
      thinking: "Intent: CHAT_FALLBACK.",
      reply: language === 'id'
        ? "Maaf, saya tidak memahami perintah tersebut. Anda dapat meminta saya mencari style, mengunduh, mengisi data ukuran/checklist, menyimpan versi, atau memverifikasi/menyelesaikan proyek."
        : "I'm sorry, I didn't catch that command. You can ask me to search, download, open, fill size/checklist data, save versions, or verify/complete your project."
    };
  }

  private handleRAGQuery(query: string, language: 'en' | 'id', projects: any[]): AgentResponse {
    // List all projects
    if (query.includes('list') || query.includes('daftar') || query.includes('semua proyek') || query.includes('tampilkan')) {
      if (projects.length === 0) {
        return {
          thinking: "RAG: List projects. Empty database.",
          reply: language === 'id'
            ? "Tidak ada proyek QC pengemasan yang tersimpan di perangkat ini saat ini."
            : "No packaging QC projects are stored on this device currently."
        };
      }
      const listStr = projects.map(p => {
        const syncStatus = p.synced ? "Synced" : "Local Draft";
        const cycleCount = (p.sessions || []).length;
        const cycleStr = cycleCount > 0 ? `v${cycleCount}.0 (${p.sessions[cycleCount-1].result || 'Pending'})` : 'No version';
        return `- **${p.article_name}** (PLM: \`${p.plm_id}\`, Status: \`${p.status}\`, ${cycleStr}, ${syncStatus})`;
      }).join('\n');

      return {
        thinking: "RAG: Listing all projects resolved from local cache.",
        reply: language === 'id'
          ? `Berikut daftar proyek QC pengemasan di perangkat Anda:\n\n${listStr}`
          : `Here is the list of packaging QC projects on your device:\n\n${listStr}`
      };
    }

    // Specific project search / details lookup
    let bestProj: any = null;
    let bestScore = 0;
    for (const p of projects) {
      const score = getFuzzyMatchScore(query, p.article_name);
      if (score > bestScore && score > 0.4) {
        bestScore = score;
        bestProj = p;
      }
    }

    if (bestProj) {
      const p = bestProj;
      const cycleCount = (p.sessions || []).length;
      const latestSession = cycleCount > 0 ? p.sessions[cycleCount - 1] : null;
      const statusStr = p.status;
      const syncStatus = p.synced ? "Synced to Server" : "Local Draft";
      
      let reply = "";
      if (language === 'id') {
        reply = `### Laporan Status: **${p.article_name}**\n` +
                `- **PLM ID / Kode**: \`${p.plm_id}\`\n` +
                `- **Status Proyek**: \`${statusStr}\` (${syncStatus})\n` +
                `- **Kuantitas PO**: ${p.po_qty || 'N/A'} unit\n` +
                `- **Jumlah Versi Inspeksi**: ${cycleCount} siklus terdaftar\n`;
        if (latestSession) {
          reply += `- **Siklus Terakhir**: Versi ${latestSession.cycle_number} (${latestSession.result})\n` +
                   `- **Kuantitas Tersedia**: ${latestSession.qty_available} pcs\n` +
                   `- **Defect Terdaftar**: ${(p.defect_images || []).length} defect foto\n` +
                   `- **Pemeriksa**: ${latestSession.inspector || '—'} (Rep pabrik: ${latestSession.factory_representative || '—'})\n`;
        }
      } else {
        reply = `### Status Report: **${p.article_name}**\n` +
                `- **PLM ID / Style Code**: \`${p.plm_id}\`\n` +
                `- **Project Status**: \`${statusStr}\` (${syncStatus})\n` +
                `- **PO Quantity**: ${p.po_qty || 'N/A'} units\n` +
                `- **Inspection Cycles**: ${cycleCount} versions logged\n`;
        if (latestSession) {
          reply += `- **Latest Cycle**: Version ${latestSession.cycle_number} (${latestSession.result})\n` +
                   `- **Available Qty**: ${latestSession.qty_available} pcs\n` +
                   `- **Defects Registered**: ${(p.defect_images || []).length} photos\n` +
                   `- **Inspector**: ${latestSession.inspector || '—'} (Factory Rep: ${latestSession.factory_representative || '—'})\n`;
        }
      }
      return {
        thinking: `RAG: Found matching project '${p.article_name}' (score: ${bestScore}). Formulating status breakdown.`,
        reply
      };
    }

    // User Guidelines / Help RAG query
    if (
      query.includes('help') || query.includes('guide') || query.includes('cara') ||
      query.includes('petunjuk') || query.includes('command') || query.includes('perintah') ||
      query.includes('rule') || query.includes('aturan') || query.includes('syarat') ||
      query.includes('inspeksi') || query.includes('denda') || query.includes('penalti') ||
      query.includes('reject') || query.includes('loss') || query.includes('hilang') ||
      query.includes('cacat') || query.includes('defect') ||
      query.includes('how') || query.includes('bagaimana') || query.includes('panduan') || query.includes('bantuan')
    ) {
      if (query.includes('denda') || query.includes('penalti') || query.includes('reject') || query.includes('lost') || query.includes('hilang')) {
        return {
          thinking: "RAG: Query matches reject or lost items input guidance.",
          reply: language === 'id'
            ? "### Cara Memasukkan Data Reject & Barang Hilang:\n" +
              "1. **Pilih Ukuran/Size**: Klik tab ukuran (seperti S, M, L, dst.) di panel detail CMT-Pak.\n" +
              "2. **Input Jumlah Reject**: Masukkan jumlah reject sesuai jenis bagian produksi (misalnya jahit/sewing, finishing, cuci/washing, sablon/printing, bordir/embro, cutting, dll.) pada kolom ukuran yang dipilih.\n" +
              "3. **Input Barang Hilang**: Masukkan jumlah barang yang hilang pada kolom **Barang Hilang** untuk ukuran tersebut.\n" +
              "4. **Cacat Foto**: Jika ada defect fisik, tambahkan foto defect menggunakan panel di sebelah kanan dengan memilih tipe defect, deskripsi, dan tingkat keparahan (major/minor)."
            : "### How to Input Rejects & Lost Items:\n" +
              "1. **Select Size Tab**: Click the size tab (e.g., S, M, L, etc.) in the CMT-Pak detail panel.\n" +
              "2. **Enter Reject Quantities**: Type the quantity of rejects under the correct category (e.g., reject cutting, sewing, finishing, washing, printing, embro, etc.) for the selected size.\n" +
              "3. **Enter Lost Garments**: Input any missing pieces in the **Barang Hilang** (Lost Garments) column for the active size.\n" +
              "4. **Log Photo Defects**: If there are physical defects, add photos in the right-hand panel by specifying the defect type, description, and severity (major/minor)."
        };
      }
 
      if (
        query.includes('command') || query.includes('perintah') || query.includes('cara') || 
        query.includes('bagaimana') || query.includes('how') || query.includes('how to')
      ) {
        return {
          thinking: "RAG: Query matches assistant commands / instructions.",
          reply: language === 'id'
            ? "### Contoh Perintah Chat Asisten AI Kaizen:\n" +
              "- **Cari Style**: `'cari Carmenta'`, `'find winter'`\n" +
              "- **Unduh & Mulai**: `'inspeksi Carmenta'`, `'inspect basic'`\n" +
              "- **Buka Workspace**: `'buka proyek Carmenta'`, `'open project PRJ-...'`\n" +
              "- **Mode Edit**: `'edit versi'`, `'ubah'`, `'edit'`\n" +
              "- **Checklist**: `'centang wash'`, `'check wash waist tag shipping'` (multi-tugas)\n" +
              "- **Input Qty**: `'setel quantity size S ke 50'`, `'set reject jahit size M jadi 2'`\n" +
              "- **Cacat Foto**: `'cacat jahit desc benang lepas major 1'`\n" +
              "- **Siklus & Simpan**: `'simpan'`, `'siklus baru'`, `'start next version'`\n" +
              "- **Tahap Akhir**: `'selesaikan proyek'`, `'sinkronkan'`, `'cetak laporan'`"
            : "### Example Chat Commands for Kaizen AI Assistant:\n" +
              "- **Search Styles**: `'search basic'`, `'find winter'`, `'cari Carmenta'`\n" +
              "- **Download Workspace**: `'inspect Carmenta'`, `'download project'`\n" +
              "- **Open Workspace**: `'open project Carmenta'`, `'buka proyek PRJ-...'`\n" +
              "- **Edit Mode**: `'edit version'`, `'edit'`, `'ubah'`\n" +
              "- **Checklist**: `'check wash'`, `'check wash waist tag shipping'` (multi-task)\n" +
              "- **Input Qty**: `'set size S quantity to 50'`, `'set size M reject sewing to 2'`\n" +
              "- **Defect Photos**: `'log defect Sewing desc loose thread major 1'`\n" +
              "- **Cycles & Save**: `'save session'`, `'simpan'`, `'start next version'`\n" +
              "- **Finish & Sync**: `'complete project'`, `'sync project'`, `'print report'`"
        };
      }
 
      return {
        thinking: "RAG: Query matches general guidelines lookup.",
        reply: language === 'id'
          ? "### Panduan Ringkas Penggunaan QCS:\n" +
            "1. **Offline-First**: Seluruh input data, checklist, dan foto cacat disimpan lokal di perangkat. Internet hanya diperlukan untuk unduhan style baru dan Sync data.\n" +
            "2. **Alur Kerja**: Pilih style → Mulai workspace → Klik 'Edit Version' → Isi checklist & qty → Tambah cacat foto → Simpan sesi → Unggah tanda tangan & klik Verify → Selesaikan proyek → Klik Sync.\n" +
            "3. **Penghapusan**: Tombol 'Remove' hanya menyembunyikan proyek secara lokal di perangkat ini, bukan menghapus di server.\n\n*Anda juga dapat melihat panduan visual lengkap dengan mengeklik tombol **Guidelines / Petunjuk** di bilah atas workspace.*"
          : "### Quick QCS Operational Guidelines:\n" +
            "1. **Offline-First**: All data logs, checklist ticks, and defect photos are cached locally. Network is only needed for initial downloads and server Sync.\n" +
            "2. **Inspection Workflow**: Select style → Start workspace → Click 'Edit Version' → Fill checklists & quantities → Log defects with photos → Save session → Upload signature & Verify → Complete project → Click Sync.\n" +
            "3. **Local Removal**: The 'Remove' button only hides the project on this device. Data remains safe on central servers.\n\n*You can also access the full visual manual by clicking the **Guidelines / Petunjuk** button in the workspace header.*"
      };
    }

    return {
      thinking: "RAG: Default QA fallback.",
      reply: language === 'id'
        ? "Saya dapat membantu Anda mencari proyek QC. Coba tanyakan: 'Daftar semua proyek' atau tanyakan status produk tertentu seperti 'Status proyek Carmenta'."
        : "I can help you search and manage your QC projects. Try asking: 'List all projects' or inquire about a specific product like 'Status of Carmenta project'."
    };
  }
}
