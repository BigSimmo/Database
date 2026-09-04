/**
 * Ward Flow — the catchment lookup: a patient's suburb to the community mental health team that
 * covers them, with an explicit review state on every answer.
 *
 * Sources: `docs/ward-flow-catchment-data.md` (the owner's five catchment documents, structured)
 * and `docs/ward-flow-referral-destination-spec.md` Parts 4, 5 and 6 (the requirements).
 *
 * Four decisions are load-bearing and are all in the spec rather than invented here:
 *
 * 1. **The key is SUBURB, never postcode.** Postcode is missing for about 42 suburbs and is
 *    present in only one of the five documents; suburb is the only field all five carry.
 *    Normalisation is case and surrounding whitespace ONLY.
 * 2. **Variants are resolved by a recorded alias table, never by fuzzy matching.** An alias
 *    somebody wrote down can be reviewed by a clinician; a similarity threshold cannot be
 *    reviewed by anybody. Every alias names the document that writes it.
 * 3. **`contested` must not route.** It behaves like `unknown` for any automatic selection.
 *    Rendering both answers and then quietly routing on one would make the display honest and the
 *    behaviour dishonest, which is worse than either alone — so the refusal is an exported
 *    predicate, not something a caller has to remember.
 * 4. **A catchment yields a SET, not one value.** The slash-hedged clinic values in the 2015
 *    document (`Peel /Rockingham` and the others like it) are not typos; they are sets written by
 *    someone with no field for a set, and they are parsed as multiple entries.
 *
 * And one deliberate absence: **no admitting hospital is seeded or derived.** Only the 2015
 * document carries that column and the owner has confirmed it stale — it omits Fiona Stanley,
 * which does admit. A derivation built and switched off would still be a decision, so there is
 * none. The approved-hospital column is not carried into this module at all.
 *
 * Nothing here corrects the sources. Spellings are reproduced exactly as each document has them,
 * typos included; aliases point AT a canonical, they never rewrite it.
 */

/** The five documents in `docs/ward-flow-catchment-data.md`, plus their dates as printed. */
export type CatchmentDocumentId = "S2015" | "S2023" | "SMETRO" | "SRPBG" | "SWACHS";

export interface CatchmentDocument {
  readonly id: CatchmentDocumentId;
  /** How the document describes itself, not a name coined here. */
  readonly label: string;
  /** The date printed on the document, or `null` when it carries none. Never inferred. */
  readonly date: string | null;
  /** Whether the document carries postcodes. Only S2015 does. */
  readonly hasPostcodes: boolean;
}

export const CATCHMENT_DOCUMENTS: Readonly<Record<CatchmentDocumentId, CatchmentDocument>> = {
  S2015: {
    id: "S2015",
    label: "Statewide catchment table — POST CODES / SUBURBS / APPROVED HOSPITAL / FOLLOW UP CLINIC",
    date: "22 November 2015",
    hasPostcodes: true,
  },
  S2023: {
    id: "S2023",
    label: "South Metropolitan Health Service — FREMANTLE / ROCKINGHAM KWINANA / PEEL suburb lists",
    date: "November 2023",
    hasPostcodes: false,
  },
  SMETRO: {
    id: "SMETRO",
    label: "Metropolitan teams with phone/fax and suburb lists",
    date: null,
    hasPostcodes: false,
  },
  SRPBG: {
    id: "SRPBG",
    label: "Royal Perth Bentley Group, Service 3 — Midland / Bentley / Inner City suburb lists",
    date: null,
    hasPostcodes: false,
  },
  SWACHS: {
    id: "SWACHS",
    label: "WACHS Link Mental Health Inter-Hospital Patient Transfer Model (image)",
    date: null,
    hasPostcodes: false,
  },
} as const;

/**
 * Counts stated by `docs/ward-flow-catchment-data.md` section 3. They are pinned here and
 * asserted in the tests so that a lookup over an emptied or truncated table cannot pass.
 */
export const S2015_STATED_ROW_COUNT = 537;
export const S2015_STATED_DISTINCT_SUBURB_COUNT = 532;
export const S2015_STATED_DISTINCT_POSTCODE_COUNT = 261;

/** postcode, suburb, follow-up clinic (verbatim), source page. Hospital is deliberately absent. */
type RawCatchmentRow = readonly [postcode: string, suburb: string, followUpClinic: string, page: number];

const RAW_S2015_ROWS: readonly RawCatchmentRow[] = [
  ["6330", "Albany", "Lower Great Southern", 1],
  ["6064", "Alexander Heights", "Mirrabooka", 1],
  ["6154", "Alfred Cove", "Alma Street (Melville)", 1],
  ["6033", "Alkimos", "Joondalup", 1],
  ["6167", "Anketel", "Kwinana", 1],
  ["6153", "Applecross", "Alma Street (Melville)", 1],
  ["6153", "Ardross", "Alma Street (Melville)", 1],
  ["6111", "Araluen", "Armadale (Mead Centre)", 1],
  ["6112", "Armadale", "Mead Centre (Armadale)", 1],
  ["6065", "Ashby", "Joondalup", 1],
  ["6111", "Ashendon", "Armadale", 1],
  ["6104", "Ascot", "Bentley", 1],
  ["6054", "Ashfield", "Midland", 1],
  ["6156", "Attadale", "Alma Street (Melville)", 1],
  ["6164", "Atwell", "Alma Street (Cockburn)", 1],
  ["6164", "Aubin Grove", "Alma Street (Cockburn)", 1],
  ["6290", "Augusta", "Bunbury", 1],
  ["6069", "Aveley", "Midland", 1],
  ["6233", "Australind", "Bunbury", 1],
  ["6521", "Badgingarra", "Wheat Belt", 1],
  ["6562", "Bakers Hill", "Northam", 1],
  ["6082", "Bailup", "Midland", 1],
  ["6253", "Balingup", "Bunbury", 1],
  ["6606", "Ballidu", "Northam", 1],
  ["6021", "Balcatta", "Osborne Park", 1],
  ["6171", "Baldivis", "Rockingham", 1],
  ["6253", "Balingup", "Bunbury", 1],
  ["6061", "Balga", "Mirrabooka", 1],
  ["6066", "Ballajura", "Mirrabooka", 1],
  ["6606", "Ballidu", "Northam", 1],
  ["6164", "Banjup", "Alma Street (Cockburn)", 1],
  ["6031", "Banksia Grove", "Joondalup", 1],
  ["6210", "Barragup", "Peel/Rockingham", 1],
  ["6054", "Bassendean", "Midland", 1],
  ["6150", "Bateman", "Alma Street (Central)", 1],
  ["6056", "Baskerville", "Midland", 1],
  ["6053", "Bayswater", "ICC", 1],
  ["6162", "Beaconsfield", "Alma Street (Central)", 1],
  ["6107", "Beckenham", "Bentley", 1],
  ["6052", "Bedford", "ICC", 1],
  ["6112", "Bedfordale", "Mead Centre (Kelmscott)", 1],
  ["6063", "Beechboro", "Midland", 1],
  ["6556", "Beechina", "Midland", 1],
  ["6164", "Beeliar", "Alma Street (Cockburn)", 1],
  ["6027", "Beldon", "Joondalup", 1],
  ["6069", "Belhus", "Midland", 1],
  ["6056", "Bellevue", "Midland", 1],
  ["6104", "Belmont", "Mills Street", 1],
  ["6223", "Benger", "Bunbury", 1],
  ["6063", "Bennett Springs", "Midland", 2],
  ["6102", "Bentley", "Mills Street", 2],
  ["6167", "Bertram", "Rockingham", 2],
  ["6304", "Beverley", "Central Wheatbelt", 2],
  ["6163", "Bibra Lake", "Alma Street (Cockburn)", 2],
  ["6076", "Bickley", "Swan", 2],
  ["6157", "Bicton", "Alma Street (Melville)", 2],
  ["6214", "Birchmont", "Kwinana/Peel", 2],
  ["6502", "Bindoon", "Northam", 2],
  ["6390", "Boddington", "Upper Great Southern", 2],
  ["6154", "Booragoon", "Alma Street (Melville)", 2],
  ["6432", "Boulder", "Nth Goldfield H.S.", 2],
  ["6237", "Boyanup", "Bunbury", 2],
  ["6056", "Boya", "Midland", 2],
  ["6244", "Boyup Brook", "Bunbury", 2],
  ["6153", "Brentwood", "Alma Street (Melville)", 2],
  ["6255", "Bridgetown", "Bunbury", 2],
  ["6069", "Brigadoon", "Midland", 2],
  ["6112", "Brookdale", "Armadale", 2],
  ["6306", "Brookton", "Great South", 2],
  ["6725", "Broome", "Kimberley HS", 2],
  ["6318", "Broomehill", "Central Great Southern", 2],
  ["6224", "Brunswick Junction", "Bunbury", 2],
  ["6418", "Bruce Rock", "Central Wheatbelt H.S.", 2],
  ["6149", "Bull Creek", "Alma Street (Melville)", 2],
  ["6084", "Bullsbrook", "Midland", 2],
  ["6231", "Bunbury", "Bunbury", 2],
  ["6230", "Bunbury", "Bunbury", 2],
  ["6028", "Burns Beach", "Clarkson", 2],
  ["6100", "Burswood", "Bentley", 2],
  ["6227", "Burekup", "Bunbury", 2],
  ["6280", "Busselton", "Bunbury", 2],
  ["6032", "Butler", "Clarkson", 2],
  ["6201", "Byford", "Mead Centre (Kelmscott)", 2],
  ["6167", "Calista", "Peel /Rockingham", 2],
  ["6111", "Camillo", "Mead Centre (Kelmscott)", 2],
  ["6111", "Canning Mills", "Mead Centre (Kelmscott)", 2],
  ["6155", "Canning Vale", "Eudoria Street (Thornlie)", 2],
  ["6107", "Cannington", "Bentley", 2],
  ["6271", "Capel", "Bunbury", 2],
  ["6033", "Carabooda", "Clarkson", 2],
  ["6201", "Cardup", "Mead Centre (Kelmscott)", 2],
  ["6031", "Carramar", "Joondalup", 2],
  ["6076", "Carilla", "Midland", 2],
  ["6230", "Carey Park", "Bunbury", 2],
  ["6020", "Carine", "Osborne", 2],
  ["6101", "Carlisle", "Bentley", 2],
  ["6076", "Carmel", "Midland", 2],
  ["6517", "Carnamah", "Midwest H.S.", 2],
  ["6701", "Carnarvon", "Gascoyne H.S.", 3],
  ["6167", "Casuarina", "Rockingham", 3],
  ["6055", "Caversham", "Midland", 3],
  ["6000", "Central Business District", "Inner City (central)", 3],
  ["6210", "Central Mandurah", "Peel", 3],
  ["6168", "Challenger", "Rockingham", 3],
  ["6111", "Champion Lakes", "Armadale", 3],
  ["6556", "Chidlow", "Midland", 3],
  ["6084", "Chittering", "Midland", 3],
  ["6798", "Christmas Island", "", 3],
  ["6018", "Churchlands", "Osborne", 3],
  ["6015", "City Beach", "Subiaco", 3],
  ["6564", "Clackline", "Northam", 3],
  ["6010", "Claremont", "Subiaco", 3],
  ["6030", "Clarkson", "Clarkson", 3],
  ["6230", "Clifton Park", "Bunbury", 3],
  ["6105", "Cloverdale", "Bentley", 3],
  ["6230", "College Grove", "Bunbury", 3],
  ["6225", "Collie", "Bunbury", 3],
  ["6152", "Como", "Bentley", 3],
  ["6027", "Connolly", "Joondalup", 3],
  ["6210", "Coodanup", "Peel/Rockingham", 3],
  ["6166", "Coogee", "Alma Street (Cockburn)", 3],
  ["6163", "Coolbellup", "Alma Street (Central)", 3],
  ["6050", "Coolbinia", "Inner City", 3],
  ["6429", "Coolgardie", "North. Goldfield H.S.", 3],
  ["6168", "Cooloongup", "Kwinana", 3],
  ["6214", "Coolup", "Peel", 3],
  ["6515", "Coorow", "Midwest H.S.", 3],
  ["6375", "Corrigin", "Upper Great Southern.", 3],
  ["6011", "Cottesloe", "Subiaco", 3],
  ["6284", "Cowaramup", "Bunbury", 3],
  ["6025", "Craigie", "Joondalup", 3],
  ["6321", "Cranbrook", "Central Great Southern.", 3],
  ["6009", "Crawley", "Subiaco", 3],
  ["6311", "Cuballing", "Upper Great Southern", 3],
  ["6640", "Cue", "Gascoyne", 3],
  ["6067", "Cullacabardee", "Midland", 3],
  ["6407", "Cunderdin", "Northam", 3],
  ["6028", "Currambine", "Joondalup", 3],
  ["6008", "Daglish", "Subiaco", 3],
  ["6009", "Dalkeith", "Subiaco", 3],
  ["6609", "Dalwallinu", "Wheat Belt", 3],
  ["6507", "Dandaragan", "Wheat Belt", 3],
  ["6236", "Dardanup", "Bunbury", 3],
  ["6065", "Darch", "Mirrabooka", 3],
  ["6122", "Darling Downs", "Armadale (Mead)", 3],
  ["6070", "Darlington", "Midland", 3],
  ["6230", "Davenport", "Bunbury", 3],
  ["6210", "Dawesville", "Peel", 4],
  ["6210", "Dudley Park", "Peel", 4],
  ["6333", "Denmark", "Great Southern.", 4],
  ["6062", "Dianella", "Mirrabooka", 4],
  ["6239", "Donnybrook", "Bunbury", 4],
  ["6018", "Doubleview", "Osborne", 4],
  ["6461", "Dowerin", "Western H.S.", 4],
  ["6350", "Dumbleyung", "Narrogin", 4],
  ["6023", "Duncraig", "Joondalup", 4],
  ["6281", "Dunsborough", "Bunbury", 4],
  ["6213", "Dwellingup", "Peel", 4],
  ["6232", "Eaton", "Bunbury", 4],
  ["6107", "East Cannington", "Mills Street", 4],
  ["6158", "East Fremantle", "Alma Street (Fremantle)", 4],
  ["6004", "East Perth", "Inner City", 4],
  ["6168", "East Rockingham", "Rockingham", 4],
  ["6100", "East Victoria Park", "Bentley", 4],
  ["6054", "Eden Hill", "Midland", 4],
  ["6027", "Edgewater", "Joondalup", 4],
  ["6034", "Eglinton", "Clarkson", 4],
  ["6069", "Ellenbrook", "Midland", 4],
  ["6062", "Embleton", "Inner City", 4],
  ["6210", "Erskine", "Peel", 4],
  ["6450", "Esperance", "Southern Coastal HS", 4],
  ["6707", "Exmouth", "Gascoyne", 4],
  ["6210", "Falcon", "Peel", 4],
  ["6148", "Ferndale", "Bentley", 4],
  ["6014", "Floreat", "Subiaco", 4],
  ["6211", "Florida Beach", "Peel", 4],
  ["6112", "Forrestdale", "Mead Centre (Kelmscott)", 4],
  ["6058", "Forrestfield", "Midland", 4],
  ["6160", "Fremantle", "Alma Street (Fremantle)", 4],
  ["6210", "Furnissdale", "Rockingham/Peel", 4],
  ["6168", "Garden Island", "Rockingham", 4],
  ["6530", "Geraldton", "Geraldton HS", 4],
  ["6448", "Gibson", "Great Southern", 4],
  ["6083", "Gidgegannup", "Midland", 4],
  ["6503", "Gingin", "Wheat belt", 4],
  ["6064", "Girrawheen", "Mirrabooka", 4],
  ["6071", "Glen Forrest", "Midland", 4],
  ["6016", "Glendalough", "Osborne", 4],
  ["6230", "Glen Iris", "Bunbury", 4],
  ["6065", "Gnangara", "Joondalup", 4],
  ["6335", "Gnowangerup", "Great Southern", 4],
  ["6174", "Golden Bay", "Rockingham", 4],
  ["6460", "Goomalling", "Wheat belt", 4],
  ["6076", "Gooseberry Hill", "Midland", 4],
  ["6110", "Gosnells", "Eudoria Street (Gosnells)", 4],
  ["6284", "Gracetown", "Bunbury", 4],
  ["6254", "Greenbush", "Bunbury", 5],
  ["6056", "Greenmount", "Midland", 5],
  ["6530", "Greenough", "Geraldton HS", 5],
  ["6024", "Greenwood", "Joondalup", 5],
  ["6210", "Greenfields", "Peel", 5],
  ["6055", "Guildford", "Midland", 5],
  ["6018", "Gwelup", "Osborne", 5],
  ["6076", "Hackett's Gully", "Midland", 5],
  ["6210", "Halls Head", "Rockingham", 5],
  ["6022", "Hamersley", "Osborne", 5],
  ["6215", "Hamel", "Peel", 5],
  ["6163", "Hamilton Hill", "Alma Street (Central)", 5],
  ["6164", "Hammond Park", "Alma Street (Cockburn)", 5],
  ["6220", "Harvey", "Bunbury", 5],
  ["6055", "Hazelmere", "Midland", 5],
  ["6027", "Heathridge", "Joondalup", 5],
  ["6056", "Helena Valley", "Midland", 5],
  ["6166", "Henderson", "Alma Street (Cockburn)", 5],
  ["6055", "Henley Brook", "Midland", 5],
  ["6017", "Herdsman", "Osborne Park", 5],
  ["6056", "Herne Hill", "Midland", 5],
  ["6210", "Herron", "Peel", 5],
  ["6057", "High Wycombe", "Midland", 5],
  ["6003", "Highgate", "Inner City", 5],
  ["6025", "Hillarys", "Joondalup", 5],
  ["6168", "Hillman", "Rockingham/Kwinana", 5],
  ["6163", "Hilton", "Alma Street (Central)", 5],
  ["6163", "Hilton Park", "Alma Street", 5],
  ["6065", "Hocking", "Joondalup", 5],
  ["6125", "Hopeland", "Armadale", 5],
  ["6348", "Hopetown", "Great Southern", 5],
  ["6165", "Hope Valley", "Rockingham", 5],
  ["6071", "Hovea", "Midland", 5],
  ["6230", "Hungry Hollow", "Bunbury", 5],
  ["6110", "Huntingdale", "Eudoria Street (Thornlie)", 5],
  ["6028", "Iluka", "Joondalup", 5],
  ["6052", "Inglewood", "Inner City", 5],
  ["6018", "Innaloo", "Osborne", 5],
  ["6525", "Irwin", "North West", 5],
  ["6056", "Jane Brook", "Midland", 5],
  ["6065", "Jandabup", "Joondalup", 5],
  ["6164", "Jandakot", "Alma Street (Cockburn)", 5],
  ["6203", "Jarrahdale", "Mead Centre (Kelmscott)", 5],
  ["6032", "Jindalee", "Clarkson", 5],
  ["6014", "Jolimont", "Subiaco", 5],
  ["6027", "Joondalup", "Joondalup", 5],
  ["6060", "Joondanna", "Osborne", 5],
  ["6751", "Juna Downs", "North West", 5],
  ["6076", "Kalamunda", "Midland", 5],
  ["6430", "Kalgoorlie", "Nth Goldfield HS", 6],
  ["6025", "Kallaroo", "Joondalup", 6],
  ["6442", "Kambalda", "Nth Goldfield HS", 6],
  ["6152", "Karawara", "Bentley", 6],
  ["6163", "Kardinya", "Alma Street (Central)", 6],
  ["6176", "Karnup", "Rockingham", 6],
  ["6111", "Karragullen", "Mead Centre (Kelmscott)", 6],
  ["6010", "Karrakatta", "Subiaco", 6],
  ["6018", "Karrinyup", "Osborne", 6],
  ["6714", "Karratha", "North West", 6],
  ["6288", "Karridale", "Bunbury", 6],
  ["6317", "Katanning", "Great Southern.", 6],
  ["6410", "Kellerberrin", "Wheatbelt HS", 6],
  ["6111", "Kelmscott", "Mead Centre (Kelmscott)", 6],
  ["6151", "Kensington", "Bentley", 6],
  ["6107", "Kenwick", "Eudoria Street (Thornlie)", 6],
  ["6105", "Kewdale", "Bentley", 6],
  ["6206", "Keysbrook", "Mead Centre (Kelmscott)", 6],
  ["6005", "Kings Park", "ICC", 6],
  ["6054", "Kiara", "Midland", 6],
  ["6026", "Kingsley", "Joondalup", 6],
  ["6028", "Kinross", "Clarkson", 6],
  ["6251", "Kirup", "Bunbury", 6],
  ["6395", "Kojonup", "Great Southern.", 6],
  ["6367", "Kondinin", "Great Southern.", 6],
  ["6064", "Koondoola", "Mirrabooka", 6],
  ["6056", "Koongamia", "Midland", 6],
  ["6714", "Karratha", "West Pilbara", 6],
  ["6743", "Kununurra", "Kimberley HS", 6],
  ["6475", "Koorda", "East Wheatbelt", 6],
  ["6365", "Kulin", "Upper Great Southern", 6],
  ["6167", "Kwinana", "Rockingham", 6],
  ["6167", "Kwinana Beach", "Kwinana", 6],
  ["6167", "Kwinana Town", "Kwinana", 6],
  ["6353", "Lake Grace", "Great Southern", 6],
  ["6210", "Lakelands", "Peel", 6],
  ["6215", "Lake Clifton", "Peel", 6],
  ["6044", "Lancelin", "Wheat Belt", 6],
  ["6065", "Landsdale", "Mirrabooka", 6],
  ["6147", "Langford", "Eudoria Street (Thornlie)", 6],
  ["6100", "Lathlain", "Bentley", 6],
  ["6440", "Laverton", "Nth Goldfield HS", 6],
  ["6170", "Leda", "Kwinana", 6],
  ["6007", "Leederville", "Inner City", 6],
  ["6149", "Leeming", "Alma Street (Melville)", 6],
  ["6438", "Leonora", "Nth Goldfield HS", 6],
  ["6076", "Lesmurdie", "Midland", 6],
  ["6076", "Lower Chittering", "Midland", 6],
  ["6054", "Lockridge", "Midland", 6],
  ["6240", "Lowden", "Bunbury", 7],
  ["6147", "Lynwood", "Bentley", 7],
  ["6109", "Maddington", "Eudoria Street (Gosnells)", 7],
  ["6210", "Madora Bay", "Peel", 7],
  ["6072", "Mahogany Creek", "Midland", 7],
  ["6057", "Maida Vale", "Midland", 7],
  ["6090", "Malaga", "Midland", 7],
  ["6065", "Madeley", "Mirrabooka", 7],
  ["6167", "Mandogalup", "Kwinana", 7],
  ["6210", "Mandurah", "Rockingham", 7],
  ["6258", "Manjimup", "Bunbury", 7],
  ["6152", "Manning", "Bentley", 7],
  ["6064", "Marangaroo", "Mirrabooka", 7],
  ["6204", "Mardella", "Mead Centre (Kelmscott)", 7],
  ["6285", "Margaret River", "Bunbury", 7],
  ["6065", "Mariginiup", "Joondalup", 7],
  ["6020", "Marmion", "Joondalup", 7],
  ["6110", "Martin", "Eudoria Street (Gosnells)", 7],
  ["6051", "Maylands", "Inner City", 7],
  ["6167", "Medina", "Kwinana", 7],
  ["6210", "Meadow Springs", "Peel", 7],
  ["6642", "Meekatharra", "Gascoyne", 7],
  ["6156", "Melville", "Alma Street (Melville)", 7],
  ["6050", "Menora", "Inner City", 7],
  ["6436", "Menzies", "Nth Goldfield HS", 7],
  ["6415", "Merredin", "East.Wheatbelt HS", 7],
  ["6030", "Merriwa", "Joondalup", 7],
  ["6056", "Middle Swan", "Midland", 7],
  ["6056", "Midland", "Midland", 7],
  ["6056", "Midvale", "Midland", 7],
  ["6056", "Millendon", "Midland", 7],
  ["6030", "Mindarie", "Clarkson", 7],
  ["6522", "Mingenew", "Gascoyne", 7],
  ["6061", "Mirrabooka", "Mirrabooka", 7],
  ["6510", "Moora", "Western HS", 7],
  ["6623", "Morawa", "Gascoyne", 7],
  ["6062", "Morley", "Inner City", 7],
  ["6012", "Mosman Park", "Subiaco", 7],
  ["6324", "Mt Barker", "Great Southern", 7],
  ["6010", "Mt Claremont", "Subiaco", 7],
  ["6016", "Mt Hawthorn", "Inner City", 7],
  ["6082", "Mt Helena", "Midland", 7],
  ["6050", "Mt Lawley", "Inner City", 7],
  ["6638", "Mt Magnet", "Gascoyne", 7],
  ["6153", "Mt Pleasant", "Alma Street (Melville)", 7],
  ["6112", "Mt Richon", "Mead Centre (Armadale)", 7],
  ["6112", "Mt Nasura", "Mead centre (Armadale)", 7],
  ["6501", "Muchea", "Western HS", 7],
  ["6479", "Mukinbudin", "Merredin", 7],
  ["6252", "Mullalyup", "Bunbury", 8],
  ["6027", "Mullaloo", "Joondalup", 8],
  ["6630", "Mullewa", "Gascoyne", 8],
  ["6073", "Mundaring", "Midland", 8],
  ["6202", "Mundijong", "Mead Centre (Kelmscott)", 8],
  ["6166", "Munster", "Alma Street (Cockburn)", 8],
  ["6150", "Murdoch", "Alma Street (Central)", 8],
  ["6154", "Myaree", "Alma Street (Central)", 8],
  ["6207", "Nambeelup", "Peel", 8],
  ["6275", "Nannup", "Bunbury", 8],
  ["6215", "Nanga Brook", "Peel", 8],
  ["6369", "Narembeen", "Merredin", 8],
  ["6312", "Narrogin", "Great Southern", 8],
  ["6753", "Newman", "North West", 8],
  ["6165", "Naval Base", "Kwinana", 8],
  ["6009", "Nedlands", "Subiaco", 8],
  ["6031", "Neerabup", "Joondalup", 8],
  ["6061", "Nollamara", "Mirrabooka", 8],
  ["6062", "Noranda", "Inner City Clinic", 8],
  ["6443", "Norseman", "South East Coastal", 8],
  ["6020", "North Beach", "Osborne", 8],
  ["6207", "North Dandalup", "Peel", 8],
  ["6262", "Northcliffe", "Bunbury", 8],
  ["6159", "North Fremantle", "Alma Street (Fremantle)", 8],
  ["6163", "North Lake", "Alma Street (Central)", 8],
  ["6006", "North Perth", "Inner City", 8],
  ["6401", "Northam", "Northam", 8],
  ["6535", "Northampton", "Geraldton HS", 8],
  ["6003", "Northbridge", "Inner City", 8],
  ["6032", "Nowergup", "Clarkson", 8],
  ["6163", "O’Connor", "Alma Street (Central)", 8],
  ["6113", "Oakford", "Mead Centre (Kelmscott)", 8],
  ["6027", "Ocean Reef", "Joondalup", 8],
  ["6710", "Onslow", "North West", 8],
  ["6109", "Orange Grove", "Eudoria Street (Gosnells)", 8],
  ["6167", "Orelia", "Kwinana", 8],
  ["6017", "Osborne Park", "Osborne", 8],
  ["6025", "Padbury", "Joondalup", 8],
  ["6157", "Palmyra", "Alma Street (Melville)", 8],
  ["6169", "Palm Beach", "Rockingham", 8],
  ["6081", "Parkerville", "Midland", 8],
  ["6147", "Parkwood", "Bentley", 8],
  ["6210", "Parklands", "Peel", 8],
  ["6167", "Parmelia", "Kwinana", 8],
  ["6076", "Paulls Valley", "Midland", 8],
  ["6085", "Pearce RAAF", "Midland", 8],
  ["6065", "Pearsall", "Joondalup", 8],
  ["6168", "Peel Estate", "Rockingham", 8],
  ["6260", "Pemberton", "Bunbury", 8],
  ["6011", "Peppermint Grove", "Subiaco", 9],
  ["6620", "Perenjori", "Geraldton HS", 9],
  ["6168", "Peron", "Rockingham", 9],
  ["6000", "Perth", "Inner City", 9],
  ["6105", "Perth Airport", "Bentley", 9],
  ["6112", "Piara Waters", "Mead Centre (Armadale)", 9],
  ["6076", "Pickering Brook", "Midland", 9],
  ["6229", "Picton", "Bunbury", 9],
  ["6076", "Piesse Brook", "Midland", 9],
  ["6308", "Pingelly", "Great Southern", 9],
  ["6065", "Pinjar", "Joondalup", 9],
  ["6208", "Pinjarra", "Peel", 9],
  ["6721", "Port Hedland", "North West", 9],
  ["6167", "Port Kennedy", "Rockingham", 9],
  ["6167", "Postans", "Kwinana", 9],
  ["6215", "Preston Beach", "Peel", 9],
  ["6383", "Quairading", "Central Wheatbelt", 9],
  ["6107", "Queens Park", "Bentley", 9],
  ["6030", "Quinns Rocks", "Clarkson", 9],
  ["6346", "Ravensthorpe", "Albany", 9],
  ["6208", "Ravenswood", "Peel", 9],
  ["6056", "Red Hill", "Midalnd", 9],
  ["6104", "Redcliffe", "Bentley", 9],
  ["6148", "Riverton", "Bentley", 9],
  ["6103", "Rivervale", "Bentley", 9],
  ["6168", "Rockingham", "Rockingham", 9],
  ["6168", "Rockingham East", "Rockingham", 9],
  ["6226", "Roelands", "Bunbury", 9],
  ["6111", "Roleystone", "Mead Centre (Kelmscott)", 9],
  ["6148", "Rossmoyne", "Bentley", 9],
  ["6161", "Rottnest Island", "Alma Street (Fremantle)", 9],
  ["6169", "Safety Bay", "Kwinana", 9],
  ["6152", "Salter Pointer", "Bentley", 9],
  ["6163", "Samson", "Alma Street (Central)", 9],
  ["6210", "San Remo", "Peel", 9],
  ["6639", "Sandstone", "Gascoyne", 9],
  ["6074", "Sawyers Valley", "Midalnd", 9],
  ["6019", "Scarborough", "Osborne", 9],
  ["6173", "Secret Harbour", "Rockingham", 9],
  ["6205", "Serpentine", "Mead Centre (Kelmscott)", 9],
  ["6112", "Seville Grove", "Mead Centre (Armadale)", 9],
  ["6537", "Shark Bay", "Gascoyne HS", 9],
  ["6155", "Shelley", "Bentley", 9],
  ["6008", "Shenton Park", "Subiaco", 9],
  ["6169", "Shoalwater", "Kwinana", 9],
  ["6210", "Silver Sands", "Peel", 9],
  ["6174", "Singleton", "Rockingham", 9],
  ["6065", "Sinagra", "Joondalup", 9],
  ["6020", "Sorrento", "Joondalup", 9],
  ["6162", "South Fremantle", "Alma Street (Fremantle)", 10],
  ["6055", "South Guildford", "Midland", 10],
  ["6722", "South Hedland", "Pilbara", 10],
  ["6164", "South Lake", "Alma Street (Cockburn)", 10],
  ["6151", "South Perth", "Bentley", 10],
  ["6426", "Southern Cross", "East Wheatbelt HS", 10],
  ["6110", "Southern River", "Eudoria Street (Thornlie)", 10],
  ["6163", "Spearwood", "Alma Street (Cockburn)", 10],
  ["6102", "St James", "Bentley", 10],
  ["6021", "Stirling", "Osborne", 10],
  ["6081", "Stoneville", "Midland", 10],
  ["6056", "Stratton", "Midland", 10],
  ["6008", "Subiaco", "Subiaco", 10],
  ["6164", "Success", "Alma Street (Cockburn)", 10],
  ["6056", "Swan View", "Midland", 10],
  ["6010", "Swanbourne", "Subiaco", 10],
  ["6030", "Tamala Park", "Clarkson", 10],
  ["6320", "Tambellup", "Central Great Southern", 10],
  ["6409", "Tammin", "Northam", 10],
  ["6065", "Tapping", "Joondalup", 10],
  ["6556", "The Lakes", "Midland", 10],
  ["6167", "The Spectacles", "Kwinana", 10],
  ["6108", "Thornlie", "Eudoria Street (Thornlie)", 10],
  ["6519", "Three Springs", "Wheat Belt", 10],
  ["6751", "Tom Price", "North West", 10],
  ["6566", "Toodyay", "Wheat Belt", 10],
  ["6488", "Trayning", "Merredin", 10],
  ["6029", "Trigg", "Osborne", 10],
  ["6060", "Tuart Hill", "Osborne", 10],
  ["6037", "Two Rocks", "Clarkson", 10],
  ["6069", "Upper Swan", "Midland", 10],
  ["6100", "Victoria Park", "Bentley", 10],
  ["6056", "Viveash", "Midland", 10],
  ["6315", "Wagin", "Great Southern", 10],
  ["6169", "Waikiki", "Rockingham", 10],
  ["6076", "Walliston", "Midland", 10],
  ["6308", "Wandering", "Upper Great Southern", 10],
  ["6167", "Wandi", "Kwinana", 10],
  ["6065", "Wangara", "Joondalup", 10],
  ["6065", "Wanneroo", "Joondalup", 10],
  ["6210", "Wannanup", "Peel", 10],
  ["6169", "Warnbro", "Rockingham", 10],
  ["6215", "Waroona", "Peel", 10],
  ["6024", "Warwick", "Joondalup", 10],
  ["6152", "Waterford", "Bentley", 10],
  ["6228", "Waterloo", "Bunbury", 10],
  ["6020", "Waterman", "Osborne", 10],
  ["6107", "Wattle Grove", "Bentley", 10],
  ["6166", "Wattleup", "Alma Street (Cockburn)", 10],
  ["6170", "Wellard", "Kwinana", 11],
  ["6106", "Welshpool", "Bentley", 11],
  ["6014", "Wembley", "Subiaco", 11],
  ["6019", "Wembley Downs", "Osborne", 11],
  ["6007", "West Leederville", "Inner City", 11],
  ["6005", "West Perth", "Inner City", 11],
  ["6055", "West Swan", "Midland", 11],
  ["6112", "Westfield", "Mead Centre (Kelmscott)", 11],
  ["6061", "Westminster", "Mirrabooka", 11],
  ["6225", "West Arthur", "Lower Great Southern", 11],
  ["6123", "Whitby", "Meade Centre (Armadale)", 11],
  ["6162", "White Gum Valley", "Alma Street (Fremantle)", 11],
  ["6068", "Whiteman", "Midland", 11],
  ["6370", "Wickepin", "Narrogin", 11],
  ["6720", "Wickham", "West Pilbara", 11],
  ["6286", "Witchcliffe", "Bunbury", 11],
  ["6038", "Wilbinga", "Osborne", 11],
  ["6156", "Willagee", "Alma Street (Melville)", 11],
  ["6155", "Willeton", "Bentley", 11],
  ["6243", "Wilga", "Bunbury", 11],
  ["6391", "Williams", "Narrogin", 11],
  ["6107", "Wilson", "Bentley", 11],
  ["6646", "Wiluna", "Murchison HS", 11],
  ["6150", "Winthrop", "Alma Street (Central)", 11],
  ["6603", "Wongan Hills-Ballidu", "Wheat Belt", 11],
  ["6221", "Wokalup", "Bunbury", 11],
  ["6168", "Woodbridge", "Rockingham", 11],
  ["6056", "Woodbridge", "Midland", 11],
  ["6316", "Woodanilling", "Wheat Belt", 11],
  ["6018", "Woodlands", "Osborne", 11],
  ["6026", "Woodvale", "Joondalup", 11],
  ["6558", "Wooroloo", "Midland", 11],
  ["6603", "Wongan Hills", "Wheat Belt", 11],
  ["6560", "Wundowie", "Wheat Belt", 11],
  ["6740", "Wyndham", "Kimberley", 11],
  ["6112", "Wungong", "Mead Centre (Kelmscott)", 11],
  ["6485", "Wyalkatchem", "East Wheatbelt", 11],
  ["6635", "Yalgoo", "Bunbury", 11],
  ["6282", "Yallingup", "Bunbury", 11],
  ["6035", "Yanchep", "Clarkson", 11],
  ["6164", "Yangebup", "Alma Street (Cockburn)", 11],
  ["6218", "Yarloop", "Bunbury", 11],
  ["6061", "Yirrigan", "Mirrabooka", 11],
  ["6060", "Yokine", "Mirrabooka", 11],
  ["6256", "Yornup", "Bunbury", 11],
  ["6302", "York", "Northam", 11],
  ["6208", "Yunderup South/North", "Peel", 11],
];

export interface S2015CatchmentRow {
  readonly postcode: string;
  /** Exactly as S2015 writes it, typos included. */
  readonly suburb: string;
  /** The follow-up clinic cell exactly as S2015 writes it, slashes and spacing included. */
  readonly followUpClinicVerbatim: string;
  /** The extracted page the row came from, so any row can be traced back. */
  readonly page: number;
}

export const S2015_CATCHMENT_ROWS: readonly S2015CatchmentRow[] = RAW_S2015_ROWS.map(
  ([postcode, suburb, followUpClinicVerbatim, page]) => ({ postcode, suburb, followUpClinicVerbatim, page }),
);

/**
 * Suburb normalisation. **Case and surrounding whitespace only** — nothing else, because every
 * further liberty taken here is a silent match nobody recorded.
 */
export function normaliseSuburbKey(suburb: string): string {
  return suburb.trim().toLowerCase();
}

/**
 * Parse a follow-up clinic cell into a SET of team names.
 *
 * The slash-hedged values are sets, not typos (spec Part 6). An unhedged cell yields a set of one,
 * which is never a special case. An empty cell yields an empty set, which the lookup turns into a
 * visible failure rather than a blank.
 *
 * Note this splits the CLINIC column only. S2015's suburb column also contains a slash
 * (`Yunderup South/North`), as does S2023's `Pinjarra/Carcoola`; those are suburb names and are
 * left exactly as written.
 */
export function parseFollowUpClinicSet(verbatim: string): readonly string[] {
  return verbatim
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export interface CatchmentAnswer {
  /** The team or teams this answer names. One entry is a set of one. */
  readonly clinics: readonly string[];
  /** The source cell before slash-splitting, kept so the source value stays auditable. */
  readonly verbatim: string;
  /** Which document says this, and its date — carried on every answer, never collapsed. */
  readonly document: CatchmentDocument;
  /** Postcodes on the rows this answer came from. Empty for documents that carry no postcodes. */
  readonly postcodes: readonly string[];
  /** Source pages this answer came from. Empty for documents extracted as suburb lists. */
  readonly pages: readonly number[];
}

/**
 * Why an alias variant exists, in the data document's own terms. `recorded` means section 4.5
 * states the two spellings are the same name; `probable` means it hedges, and the hedge is kept.
 */
export type SuburbAliasCertainty = "recorded" | "probable";

export interface SuburbAlias {
  /** The variant spelling, exactly as the naming document writes it. */
  readonly variant: string;
  /**
   * The canonical the variant resolves to: **the S2015 spelling**, because the lookup table is
   * built from S2015 alone. Where S2015 has no row at all, this is the spelling the other
   * documents agree on, and the lookup will honestly return `unknown` for it.
   */
  readonly canonical: string;
  /** The document(s) that write the variant. */
  readonly writtenBy: readonly CatchmentDocumentId[];
  /** Section 4.5's judgement, kept as a judgement. */
  readonly note: string;
  readonly certainty: SuburbAliasCertainty;
}

/**
 * The alias table — exhaustive over section 4.5 of `docs/ward-flow-catchment-data.md`, minus the
 * one row that has no canonical at all (`Solus` / `Salus`, below).
 *
 * Read the direction carefully. The canonical is whatever S2015 writes, because S2015 is the only
 * document with postcodes and therefore the only one section 3's table could be built from. For
 * `Anketel`, `Salter Pointer` and `Wannanup` that means the canonical is the spelling section 4.5
 * judges WRONG, and the better spelling is the alias. That is deliberate: the alias table resolves
 * names onto the table's key, it does not correct the table.
 */
export const SUBURB_ALIASES: readonly SuburbAlias[] = [
  {
    variant: "Anketell",
    canonical: "Anketel",
    writtenBy: ["S2023", "SMETRO"],
    note: "S2015's `Anketel` is one `l` short of every other source; S2015 is the one that looks wrong.",
    certainty: "recorded",
  },
  {
    variant: "Paulis Valley",
    canonical: "Paulls Valley",
    writtenBy: ["SMETRO"],
    note: "S2015 and SRPBG both write `Paulls Valley`, so SMETRO is the outlier and an OCR corruption.",
    certainty: "recorded",
  },
  {
    variant: "lnglewood",
    canonical: "Inglewood",
    writtenBy: ["SMETRO"],
    note: "SMETRO writes a lower-case L where a capital I belongs.",
    certainty: "recorded",
  },
  {
    variant: "lnglehope",
    canonical: "Inglehope",
    writtenBy: ["SMETRO"],
    note: "SMETRO writes a lower-case L where a capital I belongs. S2015 has no row for this place at all.",
    certainty: "recorded",
  },
  {
    variant: "lnnaloo",
    canonical: "Innaloo",
    writtenBy: ["SMETRO"],
    note: "SMETRO writes a lower-case L where a capital I belongs.",
    certainty: "recorded",
  },
  {
    variant: "lluka",
    canonical: "Iluka",
    writtenBy: ["SMETRO"],
    note: "SMETRO writes a lower-case L where a capital I belongs.",
    certainty: "recorded",
  },
  {
    variant: "Florea!",
    canonical: "Floreat",
    writtenBy: ["SMETRO"],
    note: "SMETRO reads the trailing `t` as `!`.",
    certainty: "recorded",
  },
  {
    variant: "Mt Richan",
    canonical: "Mt Richon",
    writtenBy: ["SMETRO"],
    note: "SMETRO is the one that looks wrong.",
    certainty: "recorded",
  },
  {
    variant: "Quinns Rock",
    canonical: "Quinns Rocks",
    writtenBy: ["SMETRO"],
    note: "Which spelling is correct cannot be told — both forms are in real-world use — but both name the same locality.",
    certainty: "recorded",
  },
  {
    variant: "Salter Point",
    canonical: "Salter Pointer",
    writtenBy: ["SMETRO", "SRPBG"],
    note: "S2015's `Salter Pointer` is the one that looks wrong, and it is nonetheless the table's key.",
    certainty: "recorded",
  },
  {
    variant: "Madara Bay",
    canonical: "Madora Bay",
    writtenBy: ["SMETRO"],
    note: "S2015 and S2023 agree on `Madora`; SMETRO is the outlier. SMETRO also carries a bare `Madara` under Rockingham Kwinana, which may be a second corruption of the same name in the wrong team or a real place — undetermined, and deliberately not aliased.",
    certainty: "recorded",
  },
  {
    variant: "Dudly Park",
    canonical: "Dudley Park",
    writtenBy: ["S2023", "SMETRO"],
    note: "S2023 and SMETRO agree with each other but both look wrong; S2015's `Dudley` looks correct.",
    certainty: "recorded",
  },
  {
    variant: "North Dandelup",
    canonical: "North Dandalup",
    writtenBy: ["S2023"],
    note: "S2015 and SMETRO agree on `Dandalup`; S2023 is the outlier.",
    certainty: "recorded",
  },
  {
    variant: "Wannunup",
    canonical: "Wannanup",
    writtenBy: ["S2023", "SMETRO"],
    note: "S2015's `Wannanup` is the one that looks wrong, and it is nonetheless the table's key.",
    certainty: "recorded",
  },
  {
    variant: "Alexander",
    canonical: "Alexander Heights",
    writtenBy: ["SMETRO"],
    note: "SMETRO looks truncated at a line break. The data document says `probably`, and the hedge is kept.",
    certainty: "probable",
  },
  {
    variant: "Cockburn central",
    canonical: "Cockburn Central",
    writtenBy: ["S2023"],
    note: "S2023 lower-cases the second word. S2015 has no row for this place in any spelling, so case-normalisation alone already joins these two and the lookup still ends at `unknown`.",
    certainty: "recorded",
  },
  {
    variant: "O'Connor",
    canonical: "O’Connor",
    writtenBy: ["SMETRO"],
    note: "SMETRO uses a straight apostrophe where S2015 and S2023 use a curly one, which breaks exact string matching between the sources.",
    certainty: "recorded",
  },
  {
    variant: "Mount Pleasant",
    canonical: "Mt Pleasant",
    writtenBy: ["S2023", "SMETRO"],
    note: "Abbreviation only; S2015 abbreviates and is the table's key.",
    certainty: "recorded",
  },
] as const;

/**
 * Section 4.5's one row with no determinable canonical. S2023 writes `Solus`, SMETRO writes
 * `Salus`, S2015 has neither, and there is no third source. Guessing a canonical here would be
 * inventing a suburb, so neither spelling is aliased and both resolve to `unknown`.
 */
export interface UndeterminedSuburbName {
  readonly spellings: readonly string[];
  readonly writtenBy: readonly CatchmentDocumentId[];
  readonly note: string;
}

export const UNDETERMINED_SUBURB_NAMES: readonly UndeterminedSuburbName[] = [
  {
    spellings: ["Solus", "Salus"],
    writtenBy: ["S2023", "SMETRO"],
    note: "Neither spelling can be checked against a third source and S2015 has neither. Undetermined; not aliased.",
  },
] as const;

/**
 * Names that section 4.5 records but that S2015 has no row for, so the lookup ends at `unknown`
 * even though the name is recognised. Kept explicit so the answer can say which documents DO
 * name the place, rather than implying nobody has heard of it.
 */
export const SUBURBS_NAMED_ONLY_BY_NEWER_DOCUMENTS: Readonly<Record<string, readonly CatchmentDocumentId[]>> = {
  Inglehope: ["S2023", "SMETRO"],
  "Cockburn Central": ["S2023", "SMETRO"],
} as const;

/** Which of the three internal 2015 inconsistencies a row belongs to. */
export type InternalInconsistencyId = "bentley-vs-mills-street" | "kwinana-on-two-rows" | "swan-valley-on-two-rows";

export interface InternalInconsistency {
  readonly suburb: string;
  readonly inconsistency: InternalInconsistencyId;
  readonly note: string;
}

/**
 * The three internal inconsistencies inside S2015 (spec Part 5). These are `unreviewed`: one
 * source's answer, contradicted by its neighbours and corroborated by nothing. They still route —
 * with the marker attached, so a clinician can override with the out-of-catchment reason that
 * already exists — because a value on two rows out of five hundred is either a real exception or a
 * typo, and nothing in the document distinguishes them.
 *
 * Two of the three live in the approved-hospital column, which this module deliberately does not
 * seed. The row is still marked, because the anomaly is a fact about the row's reliability whether
 * or not the anomalous column is carried; what is NOT carried is the hospital value itself.
 */
export const INTERNALLY_INCONSISTENT_SUBURBS: readonly InternalInconsistency[] = [
  {
    suburb: "Belmont",
    inconsistency: "bentley-vs-mills-street",
    note: "S2015 gives the follow-up clinic as `Mills Street` on this row and on two others, where the other 29 suburbs of the same area say `Bentley`. Mills Street is the Bentley clinic's street address.",
  },
  {
    suburb: "Bentley",
    inconsistency: "bentley-vs-mills-street",
    note: "S2015 gives the follow-up clinic as `Mills Street` on this row and on two others, where the other 29 suburbs of the same area say `Bentley`. Mills Street is the Bentley clinic's street address.",
  },
  {
    suburb: "East Cannington",
    inconsistency: "bentley-vs-mills-street",
    note: "S2015 gives the follow-up clinic as `Mills Street` on this row and on two others, where the other 29 suburbs of the same area say `Bentley`. Mills Street is the Bentley clinic's street address.",
  },
  {
    suburb: "Calista",
    inconsistency: "kwinana-on-two-rows",
    note: "S2015 names `Kwinana` as the approved hospital on exactly two rows out of 537, this one and Hope Valley, where every other Kwinana-area suburb says `Rockingham`. The hospital column is not seeded; the row is marked because the anomaly is unexplained.",
  },
  {
    suburb: "Hope Valley",
    inconsistency: "kwinana-on-two-rows",
    note: "S2015 names `Kwinana` as the approved hospital on exactly two rows out of 537, this one and Calista, where every other Kwinana-area suburb says `Rockingham`. The hospital column is not seeded; the row is marked because the anomaly is unexplained.",
  },
  {
    suburb: "Wongan Hills",
    inconsistency: "swan-valley-on-two-rows",
    note: "S2015 names `Swan Valley` as the approved hospital on exactly two rows out of 537, this one and Wundowie, where every other Wheat Belt row says `Midland`. The hospital column is not seeded; the row is marked because the anomaly is unexplained.",
  },
  {
    suburb: "Wundowie",
    inconsistency: "swan-valley-on-two-rows",
    note: "S2015 names `Swan Valley` as the approved hospital on exactly two rows out of 537, this one and Wongan Hills, where every other Wheat Belt row says `Midland`. The hospital column is not seeded; the row is marked because the anomaly is unexplained.",
  },
] as const;

export interface ContestedSuburb {
  readonly suburb: string;
  /** Both readings, each attributed. No winner is picked and the newer is never preferred. */
  readonly answers: readonly CatchmentAnswer[];
  readonly note: string;
}

/**
 * The five cross-document contradictions (section 4.1 / spec Part 5).
 *
 * **Both answers are carried, each attributed to its document and date, and no winner is picked.**
 * Recency is a coin toss with a date on it: S2023 is newer, but S2015 is the only document with
 * postcodes, so adopting S2023 would carry a 2023 team name on a 2015 postcode nobody re-verified.
 * The data document's author offered a reading and explicitly did not apply it; neither does this.
 */
export const CONTESTED_SUBURBS: readonly ContestedSuburb[] = [
  {
    suburb: "Halls Head",
    answers: [
      {
        clinics: ["Rockingham"],
        verbatim: "Rockingham",
        document: CATCHMENT_DOCUMENTS.S2015,
        postcodes: ["6210"],
        pages: [5],
      },
      { clinics: ["PEEL"], verbatim: "PEEL", document: CATCHMENT_DOCUMENTS.S2023, postcodes: [], pages: [] },
    ],
    note: "Straight contradiction, Peel versus Rockingham. SMETRO repeats S2023's reading, so a second document disagrees with S2015; none of them is decisive.",
  },
  {
    suburb: "Mandurah",
    answers: [
      {
        clinics: ["Rockingham"],
        verbatim: "Rockingham",
        document: CATCHMENT_DOCUMENTS.S2015,
        postcodes: ["6210"],
        pages: [7],
      },
      { clinics: ["PEEL"], verbatim: "PEEL", document: CATCHMENT_DOCUMENTS.S2023, postcodes: [], pages: [] },
    ],
    note: "Straight contradiction. S2015 separately lists `Central Mandurah` (6210) under clinic `Peel`, so S2015 splits Mandurah between two teams while S2023 does not.",
  },
  {
    suburb: "Furnissdale",
    answers: [
      {
        clinics: ["Rockingham", "Peel"],
        verbatim: "Rockingham/Peel",
        document: CATCHMENT_DOCUMENTS.S2015,
        postcodes: ["6210"],
        pages: [4],
      },
      { clinics: ["PEEL"], verbatim: "PEEL", document: CATCHMENT_DOCUMENTS.S2023, postcodes: [], pages: [] },
    ],
    note: "S2015 hedges with a two-team set; S2023 commits to Peel alone.",
  },
  {
    suburb: "Birchmont",
    answers: [
      {
        clinics: ["Kwinana", "Peel"],
        verbatim: "Kwinana/Peel",
        document: CATCHMENT_DOCUMENTS.S2015,
        postcodes: ["6214"],
        pages: [2],
      },
      { clinics: ["PEEL"], verbatim: "PEEL", document: CATCHMENT_DOCUMENTS.S2023, postcodes: [], pages: [] },
    ],
    note: "S2015 hedges with a two-team set; S2023 commits to Peel alone.",
  },
  {
    suburb: "Calista",
    answers: [
      {
        clinics: ["Peel", "Rockingham"],
        verbatim: "Peel /Rockingham",
        document: CATCHMENT_DOCUMENTS.S2015,
        postcodes: ["6167"],
        pages: [2],
      },
      {
        clinics: ["ROCKINGHAM KWINANA"],
        verbatim: "ROCKINGHAM KWINANA",
        document: CATCHMENT_DOCUMENTS.S2023,
        postcodes: [],
        pages: [],
      },
    ],
    note: "S2015 hedges with a two-team set and also names `Kwinana` as the approved hospital here, which it does for only one other suburb in the whole document. S2023 commits to Rockingham Kwinana. This suburb is therefore both internally inconsistent and cross-source contested; contested wins, because it is the state that refuses to route.",
  },
] as const;

/** Why a lookup could not answer. Both refuse to route; they are not interchangeable on screen. */
export type CatchmentUnknownReason =
  /** The suburb is not in the table at all — spec Part 4 outcome 3. */
  | "suburb-not-in-source-table"
  /**
   * The suburb IS in the table but the source records no follow-up clinic on it — spec Part 4
   * outcome 2, "no catchment for this suburb". `6798 Christmas Island` is the only such row.
   */
  | "suburb-in-source-table-but-no-follow-up-clinic-recorded";

/** How the queried spelling reached the table. */
export type CatchmentSuburbMatch =
  { readonly kind: "canonical" } | { readonly kind: "alias"; readonly alias: SuburbAlias };

export type CatchmentLookup =
  | {
      readonly state: "reviewed";
      readonly query: string;
      readonly suburb: string;
      readonly matchedVia: CatchmentSuburbMatch;
      readonly answers: readonly CatchmentAnswer[];
    }
  | {
      readonly state: "unreviewed";
      readonly query: string;
      readonly suburb: string;
      readonly matchedVia: CatchmentSuburbMatch;
      readonly answers: readonly CatchmentAnswer[];
      readonly inconsistency: InternalInconsistencyId;
      readonly note: string;
    }
  | {
      readonly state: "contested";
      readonly query: string;
      readonly suburb: string;
      readonly matchedVia: CatchmentSuburbMatch;
      /** Both readings. Never one. */
      readonly answers: readonly CatchmentAnswer[];
      readonly note: string;
      /**
       * True when the two readings come from the same document rather than from two documents —
       * the two duplicated S2015 suburb names whose rows disagree (`Woodbridge`, `Karratha`).
       */
      readonly withinOneDocument: boolean;
      /** Set when the row ALSO carries an internal inconsistency, so the marker is not lost. */
      readonly alsoInternallyInconsistent: InternalInconsistencyId | null;
    }
  | {
      readonly state: "unknown";
      readonly query: string;
      /** The canonical the query resolved to, when an alias matched but the table has no row. */
      readonly suburb: string | null;
      readonly matchedVia: CatchmentSuburbMatch | null;
      readonly reason: CatchmentUnknownReason;
      /** Documents that DO name this place, when any do. Empty is not the same as unrecognised. */
      readonly namedByDocuments: readonly CatchmentDocumentId[];
      readonly note: string;
    };

const ALIASES_BY_KEY: ReadonlyMap<string, SuburbAlias> = new Map(
  SUBURB_ALIASES.map((alias) => [normaliseSuburbKey(alias.variant), alias]),
);

const INCONSISTENCIES_BY_KEY: ReadonlyMap<string, InternalInconsistency> = new Map(
  INTERNALLY_INCONSISTENT_SUBURBS.map((entry) => [normaliseSuburbKey(entry.suburb), entry]),
);

const CONTESTED_BY_KEY: ReadonlyMap<string, ContestedSuburb> = new Map(
  CONTESTED_SUBURBS.map((entry) => [normaliseSuburbKey(entry.suburb), entry]),
);

const ROWS_BY_KEY: ReadonlyMap<string, readonly S2015CatchmentRow[]> = (() => {
  const grouped = new Map<string, S2015CatchmentRow[]>();
  for (const row of S2015_CATCHMENT_ROWS) {
    const key = normaliseSuburbKey(row.suburb);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }
  return grouped;
})();

/**
 * Collapse a suburb's S2015 rows into answers, one per distinct verbatim clinic string.
 *
 * Exact duplicate rows (`Balingup`, `Ballidu`) and one suburb at two postcodes with identical
 * routing (`Bunbury`) collapse to a single answer that lists both postcodes. Rows that disagree
 * (`Woodbridge` at 6168 and 6056, `Karratha` twice at 6714) stay as separate answers, and the
 * caller sees `contested`.
 */
function answersFromRows(rows: readonly S2015CatchmentRow[]): readonly CatchmentAnswer[] {
  const byVerbatim = new Map<string, { postcodes: string[]; pages: number[] }>();
  for (const row of rows) {
    const bucket = byVerbatim.get(row.followUpClinicVerbatim);
    if (bucket) {
      if (!bucket.postcodes.includes(row.postcode)) bucket.postcodes.push(row.postcode);
      if (!bucket.pages.includes(row.page)) bucket.pages.push(row.page);
    } else {
      byVerbatim.set(row.followUpClinicVerbatim, { postcodes: [row.postcode], pages: [row.page] });
    }
  }
  return [...byVerbatim.entries()].map(([verbatim, counts]) => ({
    clinics: parseFollowUpClinicSet(verbatim),
    verbatim,
    document: CATCHMENT_DOCUMENTS.S2015,
    postcodes: counts.postcodes,
    pages: counts.pages,
  }));
}

/**
 * Resolve a queried spelling to a table key, by the recorded alias table only.
 *
 * There is no fuzzy match, no edit distance and no similarity threshold anywhere in this module,
 * and adding one would defeat the point: a clinician can review a written-down alias and cannot
 * review a threshold.
 */
export function resolveSuburbAlias(query: string): SuburbAlias | null {
  return ALIASES_BY_KEY.get(normaliseSuburbKey(query)) ?? null;
}

/** The lookup. Returns exactly one of `reviewed`, `unreviewed`, `contested` or `unknown`. */
export function lookupCatchment(query: string): CatchmentLookup {
  const directKey = normaliseSuburbKey(query);
  const directRows = ROWS_BY_KEY.get(directKey);

  let suburb: string | null = null;
  let matchedVia: CatchmentSuburbMatch | null = null;
  let rows: readonly S2015CatchmentRow[] | undefined;

  if (directRows) {
    suburb = directRows[0].suburb;
    matchedVia = { kind: "canonical" };
    rows = directRows;
  } else {
    const alias = ALIASES_BY_KEY.get(directKey);
    if (alias) {
      suburb = alias.canonical;
      matchedVia = { kind: "alias", alias };
      rows = ROWS_BY_KEY.get(normaliseSuburbKey(alias.canonical));
    }
  }

  if (rows === undefined || rows.length === 0) {
    const name = suburb ?? query.trim();
    const namedBy = SUBURBS_NAMED_ONLY_BY_NEWER_DOCUMENTS[name] ?? [];
    return {
      state: "unknown",
      query,
      suburb,
      matchedVia,
      reason: "suburb-not-in-source-table",
      namedByDocuments: namedBy,
      note:
        namedBy.length > 0
          ? `No row for ${name} in the only document that carries postcodes, so no catchment can be read. Named by: ${namedBy.join(", ")}.`
          : `${name} is not recognised — it appears in no catchment document supplied.`,
    };
  }

  const matchedSuburb = suburb as string;
  const matched = matchedVia as CatchmentSuburbMatch;
  const key = normaliseSuburbKey(matchedSuburb);
  const contested = CONTESTED_BY_KEY.get(key);
  const inconsistency = INCONSISTENCIES_BY_KEY.get(key);
  const answers = answersFromRows(rows);

  // `contested` first: it is the state that refuses to route, so it must never be shadowed.
  if (contested !== undefined) {
    return {
      state: "contested",
      query,
      suburb: matchedSuburb,
      matchedVia: matched,
      answers: contested.answers,
      note: contested.note,
      withinOneDocument: false,
      alsoInternallyInconsistent: inconsistency === undefined ? null : inconsistency.inconsistency,
    };
  }

  // Two suburb names are duplicated inside S2015 with rows that disagree. Both readings come from
  // one document, but picking either would be exactly the silent guess the spec forbids, so this
  // is contested too — and says so, rather than reporting a cross-document dispute that never was.
  if (answers.length > 1) {
    return {
      state: "contested",
      query,
      suburb: matchedSuburb,
      matchedVia: matched,
      answers,
      note: `S2015 carries more than one row for ${matchedSuburb} and they do not agree. The data document records this as unresolved in the source, so no answer is chosen here.`,
      withinOneDocument: true,
      alsoInternallyInconsistent: inconsistency === undefined ? null : inconsistency.inconsistency,
    };
  }

  if (answers[0].clinics.length === 0) {
    return {
      state: "unknown",
      query,
      suburb: matchedSuburb,
      matchedVia: matched,
      reason: "suburb-in-source-table-but-no-follow-up-clinic-recorded",
      namedByDocuments: ["S2015"],
      note: `S2015 has a row for ${matchedSuburb} but records no follow-up clinic on it, so there is no catchment for this suburb to read.`,
    };
  }

  if (inconsistency !== undefined) {
    return {
      state: "unreviewed",
      query,
      suburb: matchedSuburb,
      matchedVia: matched,
      answers,
      inconsistency: inconsistency.inconsistency,
      note: inconsistency.note,
    };
  }

  return { state: "reviewed", query, suburb: matchedSuburb, matchedVia: matched, answers };
}

/**
 * **The routing predicate.** `contested` behaves like `unknown`: the clinician chooses.
 *
 * This is exported rather than left to each caller to remember, because a caller that forgets it
 * produces a screen that renders both answers honestly and then routes on one of them silently,
 * which invites trust in a decision made where the reader cannot see it.
 */
export function catchmentCanRouteAutomatically(lookup: CatchmentLookup): boolean {
  return lookup.state === "reviewed" || lookup.state === "unreviewed";
}

/**
 * The teams a lookup may route to, or `null` when it must not route at all.
 *
 * `null` rather than an empty array on purpose: an empty array reads as "no teams", and a caller
 * that spreads it would route to nothing rather than stopping and asking.
 */
export function catchmentRoutingDestinations(lookup: CatchmentLookup): readonly string[] | null {
  if (lookup.state !== "reviewed" && lookup.state !== "unreviewed") return null;
  return lookup.answers.flatMap((answer) => answer.clinics);
}
