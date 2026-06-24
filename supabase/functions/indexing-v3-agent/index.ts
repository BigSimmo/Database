import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import postgres from 'npm:postgres@3.4.7'

type ClaimedJob = {
  id: string
  document_id: string
  batch_id: string | null
  attempt_count: number
  max_attempts: number
  documents: {
    id: string
    owner_id: string | null
    title: string | null
    metadata: Record<string, unknown> | null
  }
}

type ImageRow = {
  id: string
  page_number: number | null
  image_type: string | null
  searchable: boolean | null
  caption: string | null
  metadata: Record<string, unknown> | null
  width: number | null
  height: number | null
  source_kind: string | null
  clinical_relevance_score: number | null
  skip_reason: string | null
}

type VisualUnit = {
  unitType: string
  title: string
  content: string
  qualityScore: number
  normalizedTerms: string[]
  page: number | null
  sourceImageId: string
  metadata: Record<string, unknown>
}

type SectionIndexSource = {
  section_id: string
  heading: string
  heading_path: string[] | null
  page_start: number | null
  page_end: number | null
  chunk_ids: string[] | null
  summary: string
  tags: string[] | null
  extraction_quality: string | null
  source_chunk_id: string
  anchor_id: string
  chunk_index: number
  chunk_metadata: Record<string, unknown> | null
}

type GeneratedLabelCandidate = {
  label: string
  label_type: 'topic' | 'document_type' | 'medication' | 'risk' | 'setting' | 'workflow' | 'population' | 'service' | 'custom'
  confidence: number
  metadata: Record<string, unknown>
}

type SectionLabelSource = {
  section_id: string
  heading: string
  heading_path: string[] | null
  summary: string
  tags: string[] | null
  source_chunk_id: string
  anchor_id: string
  chunk_index: number
}

type MemoryCardLabelSource = {
  card_id: string
  card_type: string
  title: string
  content: string
}

type CompletionGate = {
  counts: {
    sections: number
    memory_cards: number
    generated_labels: number
    index_units: number
  }
  presence: {
    title_embedding: boolean
    summary_embedding: boolean
  }
  missing: string[]
  result: 'complete' | 'deferred'
}

const GENERATED_BY = 'indexing-v3-agent'
const AGENT_SECRET = Deno.env.get('INDEXING_V3_AGENT_SECRET') ?? Deno.env.get('CRON_SECRET') ?? ''
const EXPECTED_EMBED_DIM = 1536

const SUPABASE_DB_URL = Deno.env.get('SUPABASE_DB_URL')
if (!SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required')

const sql = postgres(SUPABASE_DB_URL, {
  max: 4,
  idle_timeout: 20,
  connect_timeout: 10,
})

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required')

const OPENAI_EMBEDDING_MODEL = Deno.env.get('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small'
const EMBEDDING_DIMENSIONS = Number(Deno.env.get('EMBEDDING_DIMENSIONS') ?? String(EXPECTED_EMBED_DIM))
if (EMBEDDING_DIMENSIONS !== EXPECTED_EMBED_DIM) {
  throw new Error(`EMBEDDING_DIMENSIONS must be ${EXPECTED_EMBED_DIM}`)
}

const VISUAL_FIELD_TYPES = [
  'image_caption',
  'clinical_action',
  'threshold_fact',
]

const VISUAL_UNIT_TYPES = [
  'clinical_fact',
  'workflow_step',
  'threshold',
  'medication_monitoring',
  'askable_question',
]

const TYPE_BUDGET: Record<string, number> = {
  clinical_table: 10,
  flowchart_algorithm: 8,
  risk_matrix: 8,
  medication_chart: 8,
  form_checklist: 6,
  graph: 6,
  screenshot_ui: 3,
  photo: 2,
  unclear: 4,
}

function authorizeRequest(req: Request): Response | null {
  if (!AGENT_SECRET) {
    return Response.json({ ok: false, error: 'INDEXING_V3_AGENT_SECRET is required when JWT verification is disabled' }, { status: 500 })
  }

  const authorization = req.headers.get('authorization') ?? ''
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  const headerSecret =
    req.headers.get('x-indexing-agent-secret') ??
    req.headers.get('x-cron-secret') ??
    bearer ??
    ''

  if (headerSecret !== AGENT_SECRET) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

function normalizeText(v: string): string {
  return v.replace(/\s+/g, ' ').trim()
}

function assertEmbeddingDim(vec: unknown, context: string): asserts vec is number[] {
  if (!Array.isArray(vec)) {
    throw new Error(`${context} embedding must be an array`)
  }
  if (vec.length !== EXPECTED_EMBED_DIM) {
    throw new Error(`${context} embedding has ${vec.length} dimensions; expected ${EXPECTED_EMBED_DIM}`)
  }
  const badIndex = vec.findIndex((value) => typeof value !== 'number' || !Number.isFinite(value))
  if (badIndex >= 0) {
    throw new Error(`${context} embedding has a non-finite number at index ${badIndex}`)
  }
}

function tokenize(v: string): string[] {
  return Array.from(new Set(normalizeText(v).toLowerCase().split(/[^a-z0-9]+/g).filter((x) => x.length > 2))).slice(0, 40)
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function embedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`OpenAI embedding request failed (${response.status}): ${body.slice(0, 500)}`)
  }

  const payload = await response.json() as { data?: Array<{ embedding?: unknown }> }
  const out = payload.data?.[0]?.embedding
  assertEmbeddingDim(out, 'OpenAI response')
  return out
}

function parseStructuredVisual(image: ImageRow): {
  visual_type: string
  clinical_purpose: string
  key_terms: string[]
  actions: string[]
  thresholds: string[]
  medications: string[]
  monitoring_items: string[]
  flowchart_nodes: string[]
  flowchart_edges: string[]
  risk_matrix_axes: string[]
  chart_axes: string[]
  table_column_roles: string[]
  source_regions: Array<Record<string, unknown>>
  confidence: number
} {
  const caption = normalizeText(image.caption ?? '')
  const textBlob = normalizeText(`${caption} ${JSON.stringify(image.metadata ?? {})}`)
  const lower = textBlob.toLowerCase()

  const actions = Array.from(lower.matchAll(/\b(start|stop|escalat[e]?|administer|monitor|review|refer|cease|repeat)\b/g)).map((m) => m[1])
  const thresholds = Array.from(lower.matchAll(/\b(\d+(?:\.\d+)?\s?(?:mg|mmol|ml|%|bpm|mmhg|days?|hours?))\b/g)).map((m) => m[1])
  const medications = Array.from(lower.matchAll(/\b(olanzapine|clozapine|haloperidol|diazepam|lithium|insulin|heparin|warfarin|digoxin)\b/g)).map((m) => m[1])

  let visualType = image.image_type ?? 'unclear'
  if (lower.includes('flowchart') || lower.includes('decision')) visualType = 'flowchart_algorithm'
  if (lower.includes('risk matrix') || lower.includes('likelihood') || lower.includes('consequence')) visualType = 'risk_matrix'
  if (lower.includes('dose') || lower.includes('route') || lower.includes('frequency')) visualType = 'medication_chart'

  const flowchartNodes = visualType === 'flowchart_algorithm'
    ? Array.from(new Set(Array.from(textBlob.matchAll(/\b(if|then|else|review|escalate|observe|admit|discharge)\b/gi)).map((m) => m[0].toLowerCase())))
    : []

  const riskAxes = visualType === 'risk_matrix'
    ? Array.from(new Set(Array.from(textBlob.matchAll(/\b(likelihood|consequence|severity|impact|probability)\b/gi)).map((m) => m[0].toLowerCase())))
    : []

  const chartAxes = visualType === 'graph'
    ? Array.from(new Set(Array.from(textBlob.matchAll(/\b(x-axis|y-axis|time|rate|dose|response)\b/gi)).map((m) => m[0].toLowerCase())))
    : []

  const columnRoles = Array.from(new Set(Array.from(textBlob.matchAll(/\b(parameter|threshold|action|dose|route|frequency|monitoring|risk|notes?)\b/gi)).map((m) => m[0].toLowerCase())))

  const confidence = Math.min(0.95, 0.45 + (caption.length > 50 ? 0.15 : 0) + (actions.length > 0 ? 0.1 : 0) + (thresholds.length > 0 ? 0.1 : 0) + (medications.length > 0 ? 0.1 : 0))

  return {
    visual_type: visualType,
    clinical_purpose: caption.length > 0 ? caption.slice(0, 180) : 'Visual clinical evidence',
    key_terms: tokenize(textBlob),
    actions: Array.from(new Set(actions)).slice(0, 20),
    thresholds: Array.from(new Set(thresholds)).slice(0, 20),
    medications: Array.from(new Set(medications)).slice(0, 20),
    monitoring_items: Array.from(new Set(Array.from(textBlob.matchAll(/\b(monitor|observation|vitals?|follow-up|repeat)\b/gi)).map((m) => m[0].toLowerCase()))).slice(0, 20),
    flowchart_nodes: flowchartNodes.slice(0, 20),
    flowchart_edges: flowchartNodes.length > 1 ? flowchartNodes.slice(1).map((n, i) => `${flowchartNodes[i]} -> ${n}`) : [],
    risk_matrix_axes: riskAxes.slice(0, 10),
    chart_axes: chartAxes.slice(0, 10),
    table_column_roles: columnRoles.slice(0, 12),
    source_regions: [],
    confidence,
  }
}

function scoreImage(image: ImageRow): number {
  const width = image.width ?? 0
  const height = image.height ?? 0
  const areaScore = Math.min(1, (width * height) / 1_000_000)
  const searchableScore = image.searchable ? 0.2 : -0.4
  const baseClinical = image.clinical_relevance_score ?? 0
  const typeBoost = ({
    clinical_table: 0.35,
    flowchart_algorithm: 0.4,
    risk_matrix: 0.35,
    medication_chart: 0.4,
    form_checklist: 0.25,
    graph: 0.25,
    screenshot_ui: 0.05,
    photo: 0.02,
    logo_decorative: -0.8,
    unclear: 0.0,
  } as Record<string, number>)[image.image_type ?? 'unclear'] ?? 0

  const caption = normalizeText(image.caption ?? '')
  const termBoost = /dose|route|threshold|algorithm|flowchart|risk|monitor|escalat|red zone|action/i.test(caption) ? 0.2 : 0

  return baseClinical + typeBoost + areaScore * 0.15 + searchableScore + termBoost
}

function chooseByBudget(images: Array<ImageRow & { priority: number }>): Array<ImageRow & { priority: number }> {
  const byType = new Map<string, Array<ImageRow & { priority: number }>>()
  for (const i of images) {
    const t = i.image_type ?? 'unclear'
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(i)
  }
  for (const arr of byType.values()) arr.sort((a, b) => b.priority - a.priority)

  const picked: Array<ImageRow & { priority: number }> = []
  for (const [t, arr] of byType.entries()) {
    const budget = TYPE_BUDGET[t] ?? 3
    picked.push(...arr.slice(0, budget))
  }

  const unique = new Map<string, ImageRow & { priority: number }>()
  for (const p of picked) unique.set(p.id, p)

  return Array.from(unique.values()).sort((a, b) => b.priority - a.priority).slice(0, 40)
}

async function stageStart(job: ClaimedJob, stageName: string, metadata: Record<string, unknown> = {}): Promise<string> {
  const row = await sql<{ id: string }[]>`
    insert into public.ingestion_job_stages (
      job_id, document_id, stage_name, stage_status, metadata
    ) values (
      ${job.id}::uuid,
      ${job.document_id}::uuid,
      ${stageName},
      'started',
      ${JSON.stringify(metadata)}::jsonb
    )
    returning id
  `
  return row[0].id
}

async function stageFinish(stageId: string, ok: boolean, artifactCounts: Record<string, unknown> = {}, errorMessage?: string): Promise<void> {
  await sql`
    update public.ingestion_job_stages
    set
      stage_status = ${ok ? 'completed' : 'failed'},
      finished_at = now(),
      artifact_counts = ${JSON.stringify(artifactCounts)}::jsonb,
      error_message = ${errorMessage ?? null}
    where id = ${stageId}::uuid
  `
}

async function ensureSummary(job: ClaimedJob): Promise<string> {
  const existing = await sql<{ summary: string }[]>`
    select summary
    from public.document_summaries
    where document_id = ${job.document_id}::uuid
    limit 1
  `
  if (existing.length > 0) return normalizeText(existing[0].summary)

  const chunks = await sql<{ id: string; content: string; chunk_index: number }[]>`
    select id, content, chunk_index
    from public.document_chunks
    where document_id = ${job.document_id}::uuid
    order by chunk_index asc
    limit 24
  `

  const merged = normalizeText(chunks.map((c) => c.content ?? '').join(' '))
  const summary = merged.length > 1800 ? `${merged.slice(0, 1800)}...` : merged

  await sql`
    insert into public.document_summaries (
      document_id, owner_id, summary, source_chunk_ids, model, metadata, generated_at
    ) values (
      ${job.document_id}::uuid,
      ${job.documents.owner_id}::uuid,
      ${summary.length > 0 ? summary : 'Summary unavailable'}::text,
      ${chunks.map((c) => c.id)}::uuid[],
      'v3-summary-heuristic',
      ${JSON.stringify({ generated_by: GENERATED_BY })}::jsonb,
      now()
    )
    on conflict (document_id)
    do update set
      summary = excluded.summary,
      source_chunk_ids = excluded.source_chunk_ids,
      model = excluded.model,
      metadata = excluded.metadata,
      generated_at = now(),
      updated_at = now()
  `

  return summary.length > 0 ? summary : 'Summary unavailable'
}

function unitsFromStructured(image: ImageRow, structured: ReturnType<typeof parseStructuredVisual>): VisualUnit[] {
  const units: VisualUnit[] = []
  const page = image.page_number ?? null
  const imageId = image.id

  const summaryText = normalizeText(`${structured.clinical_purpose}. Key terms: ${structured.key_terms.slice(0, 12).join(', ')}`)
  if (summaryText.length > 12) {
    units.push({
      unitType: 'visual_summary',
      title: `Visual summary p${page ?? '?'} (${structured.visual_type})`,
      content: summaryText,
      qualityScore: structured.confidence,
      normalizedTerms: structured.key_terms,
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  for (const a of structured.actions.slice(0, 8)) {
    units.push({
      unitType: structured.visual_type === 'flowchart_algorithm' ? 'flowchart_step' : 'chart_finding',
      title: `Action from visual p${page ?? '?'}`,
      content: `Action: ${a}`,
      qualityScore: Math.max(0.5, structured.confidence - 0.05),
      normalizedTerms: tokenize(a),
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  for (const t of structured.thresholds.slice(0, 8)) {
    units.push({
      unitType: 'table_threshold',
      title: `Threshold from visual p${page ?? '?'}`,
      content: `Threshold: ${t}`,
      qualityScore: Math.max(0.5, structured.confidence - 0.05),
      normalizedTerms: tokenize(t),
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  for (const m of structured.medications.slice(0, 8)) {
    units.push({
      unitType: 'medication_chart_row',
      title: `Medication from visual p${page ?? '?'}`,
      content: `Medication reference: ${m}`,
      qualityScore: Math.max(0.5, structured.confidence - 0.03),
      normalizedTerms: tokenize(m),
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  for (const n of structured.flowchart_nodes.slice(0, 8)) {
    units.push({
      unitType: 'diagram_decision',
      title: `Flowchart node p${page ?? '?'}`,
      content: `Node: ${n}`,
      qualityScore: Math.max(0.5, structured.confidence - 0.06),
      normalizedTerms: tokenize(n),
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  for (const ax of structured.risk_matrix_axes.slice(0, 8)) {
    units.push({
      unitType: 'risk_matrix_cell',
      title: `Risk matrix axis p${page ?? '?'}`,
      content: `Risk axis dimension: ${ax}`,
      qualityScore: Math.max(0.5, structured.confidence - 0.08),
      normalizedTerms: tokenize(ax),
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  if (structured.key_terms.length > 0) {
    units.push({
      unitType: 'visual_askable_question',
      title: `Askable visual question p${page ?? '?'}`,
      content: `What actions, thresholds, or medication details are shown in this ${structured.visual_type} visual?`,
      qualityScore: Math.max(0.45, structured.confidence - 0.1),
      normalizedTerms: structured.key_terms,
      page,
      sourceImageId: imageId,
      metadata: { visual_type: structured.visual_type },
    })
  }

  return units
}

function canonicalUnitType(unitType: string): string {
  switch (unitType) {
    case 'flowchart_step':
    case 'diagram_decision':
      return 'workflow_step'
    case 'table_threshold':
    case 'risk_matrix_cell':
      return 'threshold'
    case 'medication_chart_row':
      return 'medication_monitoring'
    case 'visual_askable_question':
      return 'askable_question'
    case 'visual_summary':
    case 'chart_finding':
    default:
      return 'clinical_fact'
  }
}

function canonicalFieldType(unitType: string): string {
  switch (unitType) {
    case 'flowchart_step':
    case 'diagram_decision':
    case 'medication_chart_row':
      return 'clinical_action'
    case 'table_threshold':
    case 'risk_matrix_cell':
      return 'threshold_fact'
    case 'visual_summary':
    case 'chart_finding':
    case 'visual_askable_question':
    default:
      return 'image_caption'
  }
}

function normalizeLabel(value: string): string {
  const cleaned = normalizeText(value.toLowerCase().replace(/["'`]|[().,:;!?[\]{}]/g, ' ').replace(/\s+/g, ' '))
  return cleaned.slice(0, 72).trim()
}

function inferLabelType(text: string): GeneratedLabelCandidate['label_type'] {
  const hay = normalizeText(text).toLowerCase()
  if (/(clozapine|lithium|antipsychotic|antidepressant|insulin|antibiotic|opioid|benzodiazepine|medicat|doses?|tablet|drug|prescription)/.test(hay)) return 'medication'
  if (/(risk|safety|seclusion|restraint|suicide|self.?harm|violence|agitation|escalat)/.test(hay)) return 'risk'
  if (/(home|community|inpatient|outpatient|ward|clinic|hospital|emergency|ambulance|unit|setting)/.test(hay)) return 'setting'
  if (/(workflow|pathway|process|algorithm|protocol|care.?plan|admission|discharge|handoff)/.test(hay)) return 'workflow'
  if (/(document|guideline|policy|manual|procedure|form|checklist|assessment|screening|brief)/.test(hay)) return 'document_type'
  if (/(child|children|adult|adolescent|elderly|geriatric|neonat|pediatric|prenatal|pregnant|population|service user)/.test(hay)) return 'population'
  if (/(service|team|multidisciplinary|support)/.test(hay)) return 'service'
  return 'topic'
}

function normalizeLabelCandidate(rawLabel: string): string | null {
  const normalized = normalizeLabel(rawLabel)
  if (!normalized || normalized.length < 3) return null
  if (['unknown', 'n/a', 'na', 'tbc', 'nil'].includes(normalized)) return null
  return normalized
}

function pushLabelCandidate(
  candidates: Map<string, GeneratedLabelCandidate>,
  rawLabel: string,
  labelType: GeneratedLabelCandidate['label_type'],
  confidence: number,
  metadata: Record<string, unknown>,
) {
  const label = normalizeLabelCandidate(rawLabel)
  if (!label) return
  const key = `${labelType}::${label}`
  const existing = candidates.get(key)
  if (existing) {
    existing.confidence = Math.max(existing.confidence, confidence)
    existing.metadata = { ...existing.metadata, ...metadata }
    return
  }

  candidates.set(key, {
    label,
    label_type: labelType,
    confidence,
    metadata,
  })
}

function mapMemoryCardTypeToLabelType(cardType: string): GeneratedLabelCandidate['label_type'] {
  if (cardType === 'medication') return 'medication'
  if (cardType === 'risk') return 'risk'
  if (cardType === 'workflow') return 'workflow'
  if (cardType === 'table_row' || cardType === 'askable_question' || cardType === 'section_summary' || cardType === 'definition' || cardType === 'citation_anchor') return 'topic'
  return 'custom'
}

function candidateConfidence(base: number, source: string): number {
  if (source === 'document_title') return Math.min(0.82, base + 0.08)
  if (source === 'section_heading') return Math.min(0.9, base + 0.12)
  if (source === 'memory_card_title') return Math.min(0.86, base + 0.1)
  if (source === 'section_tag') return Math.min(0.74, base + 0.08)
  if (source === 'memory_card_content') return Math.min(0.76, base + 0.06)
  return base
}

async function upsertGeneratedLabelsFromParsedArtifacts(job: ClaimedJob): Promise<number> {
  const sections = await sql<SectionLabelSource[]>`
    select
      s.id as section_id,
      s.heading,
      s.heading_path,
      coalesce(s.summary, '') as summary,
      s.tags,
      c.id as source_chunk_id,
      c.anchor_id,
      c.chunk_index
    from public.document_sections s
    join lateral (
      select id, anchor_id, chunk_index
      from public.document_chunks c
      where c.document_id = s.document_id
        and c.anchor_id is not null
        and (
          c.id = any(s.chunk_ids)
          or c.section_heading = s.heading
        )
      order by
        case when c.id = any(s.chunk_ids) then 0 else 1 end,
        c.chunk_index asc
      limit 1
    ) c on true
    where s.document_id = ${job.document_id}::uuid
    and btrim(coalesce(s.summary, '')) <> ''
    order by s.section_index asc
  `

  const cards = await sql<MemoryCardLabelSource[]>`
    select
      id as card_id,
      card_type,
      title,
      content
    from public.document_memory_cards
    where document_id = ${job.document_id}::uuid
    order by created_at desc
  `

  const candidates = new Map<string, GeneratedLabelCandidate>()
  const sectionCount = sections.length
  const cardCount = cards.length

  if (job.documents.title) {
    pushLabelCandidate(
      candidates,
      job.documents.title,
      inferLabelType(job.documents.title),
      candidateConfidence(0.68, 'document_title'),
      { source: 'document_title', source_text: job.documents.title },
    )
  }

  for (const section of sections) {
    pushLabelCandidate(
      candidates,
      section.heading,
      inferLabelType(section.heading),
      candidateConfidence(0.78, 'section_heading'),
      {
        source: 'document_section',
        section_id: section.section_id,
        source_chunk_id: section.source_chunk_id,
        chunk_index: section.chunk_index,
        anchor_id: section.anchor_id,
      },
    )

    if ((section.heading_path ?? []).length > 0) {
      const pathLabel = section.heading_path!.join(' > ')
      if (pathLabel.length > 4) {
        pushLabelCandidate(
          candidates,
          pathLabel,
          inferLabelType(section.heading),
          candidateConfidence(0.56, 'section_tag'),
          {
            source: 'document_section_path',
            section_id: section.section_id,
            source_chunk_id: section.source_chunk_id,
            chunk_index: section.chunk_index,
            anchor_id: section.anchor_id,
          },
        )
      }
    }

    for (const tag of section.tags ?? []) {
      pushLabelCandidate(
        candidates,
        tag,
        inferLabelType(tag),
        candidateConfidence(0.62, 'section_tag'),
        {
          source: 'document_section_tag',
          section_id: section.section_id,
          source_chunk_id: section.source_chunk_id,
          chunk_index: section.chunk_index,
          anchor_id: section.anchor_id,
        },
      )
    }
  }

  for (const card of cards) {
    const labelType = mapMemoryCardTypeToLabelType(card.card_type)
    pushLabelCandidate(
      candidates,
      card.title,
      labelType,
      candidateConfidence(0.72, 'memory_card_title'),
      {
        source: 'document_memory_card',
        card_id: card.card_id,
        card_type: card.card_type,
      },
    )
    for (const term of tokenize(card.content).slice(0, 3)) {
      pushLabelCandidate(
        candidates,
        term,
        labelType,
        candidateConfidence(0.55, 'memory_card_content'),
        {
          source: 'document_memory_card_content',
          card_id: card.card_id,
          card_type: card.card_type,
        },
      )
    }
  }

  const prepared = Array.from(candidates.values()).slice(0, 80)
  if (prepared.length === 0) return 0

  const inserted = await sql.begin(async (tx) => {
    let count = 0
    for (const candidate of prepared) {
      await tx`
        insert into public.document_labels (
          document_id,
          owner_id,
          label,
          label_type,
          source,
          confidence,
          metadata
        ) values (
          ${job.document_id}::uuid,
          ${job.documents.owner_id}::uuid,
          ${candidate.label},
          ${candidate.label_type},
          'generated',
          ${Math.min(0.98, Math.max(0.2, candidate.confidence))},
          ${JSON.stringify({
            ...candidate.metadata,
            generated_by: GENERATED_BY,
            generation_source: 'indexing_v3_agent_parsed_artifacts',
            section_candidates: sectionCount,
            memory_card_candidates: cardCount,
            fallback_generated_count: prepared.length,
          })}::jsonb
        )
        on conflict (document_id, label_type, label, source)
        do update set
          confidence = greatest(document_labels.confidence, excluded.confidence),
          metadata = coalesce(document_labels.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = now()
      `
      count += 1
    }
    return count
  })

  return inserted
}

async function upsertSectionIndexUnits(job: ClaimedJob): Promise<number> {
  const sections = await sql<SectionIndexSource[]>`
    select
      s.id as section_id,
      s.heading,
      s.heading_path,
      s.page_start,
      s.page_end,
      s.chunk_ids,
      s.summary,
      s.tags,
      s.extraction_quality,
      c.id as source_chunk_id,
      c.anchor_id,
      c.chunk_index,
      c.metadata as chunk_metadata
    from public.document_sections s
    join lateral (
      select id, anchor_id, chunk_index, metadata
      from public.document_chunks c
      where c.document_id = s.document_id
        and c.anchor_id is not null
        and (
          c.id = any(s.chunk_ids)
          or c.section_heading = s.heading
        )
      order by
        case when c.id = any(s.chunk_ids) then 0 else 1 end,
        c.chunk_index asc
      limit 1
    ) c on true
    where s.document_id = ${job.document_id}::uuid
      and btrim(coalesce(s.summary, '')) <> ''
    order by s.section_index asc
  `

  await sql`
    delete from public.document_index_units
    where document_id = ${job.document_id}::uuid
      and unit_type = 'section_summary'
      and metadata->>'generated_by' = ${GENERATED_BY}
      and metadata->>'source' = 'document_sections'
  `

  let inserted = 0
  for (const section of sections) {
    const content = normalizeText(section.summary)
    const title = normalizeText(section.heading)
    if (!content || !title) continue

    const emb = await embedding(`Type: section_summary\nTitle: ${title}\nPath: ${(section.heading_path ?? []).join(' > ')}\nContent: ${content}`)
    assertEmbeddingDim(emb, `section index unit ${section.section_id}`)

    await sql`
      insert into public.document_index_units (
        owner_id,
        document_id,
        unit_type,
        source_chunk_id,
        source_image_id,
        page_start,
        page_end,
        heading_path,
        title,
        content,
        normalized_terms,
        source_span,
        quality_score,
        extraction_mode,
        embedding,
        metadata
      ) values (
        ${job.documents.owner_id}::uuid,
        ${job.document_id}::uuid,
        'section_summary',
        ${section.source_chunk_id}::uuid,
        null,
        ${section.page_start},
        ${section.page_end},
        ${section.heading_path ?? []}::text[],
        ${title},
        ${content},
        ${tokenize(`${title} ${content} ${(section.tags ?? []).join(' ')}`)}::text[],
        ${JSON.stringify({ anchor_id: section.anchor_id, chunk_index: section.chunk_index })}::jsonb,
        ${section.extraction_quality === 'good' ? 0.78 : section.extraction_quality === 'partial' ? 0.58 : 0.42},
        'hybrid',
        ${JSON.stringify(emb)}::vector,
        ${JSON.stringify({
          generated_by: GENERATED_BY,
          source: 'document_sections',
          section_id: section.section_id,
          chunk_ids: section.chunk_ids ?? [],
          anchor_id: section.anchor_id,
        })}::jsonb
      )
    `
    inserted += 1
  }

  return inserted
}

async function upsertVisualArtifacts(job: ClaimedJob): Promise<{ selected_images: number; created_units: number; created_fields: number }> {
  const images = await sql<ImageRow[]>`
    select
      id, page_number, image_type, searchable, caption, metadata,
      width, height, source_kind, clinical_relevance_score, skip_reason
    from public.document_images
    where document_id = ${job.document_id}::uuid
      and coalesce(searchable, false) = true
      and coalesce(image_type, 'unclear') <> 'logo_decorative'
    order by page_number asc nulls last, created_at asc
  `

  const scored = images
    .map((img) => ({ ...img, priority: scoreImage(img) }))
    .filter((img) => img.priority > -0.2)

  const selected = chooseByBudget(scored)

  await sql.begin(async (tx) => {
    await tx`
      delete from public.document_embedding_fields
      where document_id = ${job.document_id}::uuid
        and field_type = any(${VISUAL_FIELD_TYPES}::text[])
        and metadata->>'generated_by' = ${GENERATED_BY}
    `

    await tx`
      delete from public.document_index_units
      where document_id = ${job.document_id}::uuid
        and unit_type = any(${VISUAL_UNIT_TYPES}::text[])
        and metadata->>'generated_by' = ${GENERATED_BY}
    `
  })

  let createdUnits = 0
  let createdFields = 0

  for (const img of selected) {
    const structured = parseStructuredVisual(img)
    const units = unitsFromStructured(img, structured)

    await sql`
      update public.document_images
      set
        clinical_priority_score = ${img.priority},
        caption_confidence = ${Math.max(0.35, Math.min(0.98, structured.confidence - 0.05))},
        structured_extraction_confidence = ${structured.confidence},
        ocr_text_density = ${Math.max(0, Math.min(1, (structured.key_terms.length / 40)))},
        image_quality_score = ${Math.max(0, Math.min(1, 0.35 + img.priority * 0.3))},
        crop_completeness = ${Math.max(0.3, Math.min(1, (img.width && img.height && img.width * img.height > 150000) ? 0.9 : 0.55))},
        metadata = coalesce(metadata, '{}'::jsonb) || ${JSON.stringify({ v3_structured_visual: structured })}::jsonb
      where id = ${img.id}::uuid
    `

    for (const unit of units) {
      const content = normalizeText(unit.content)
      if (content.length < 4) continue

      const unitType = canonicalUnitType(unit.unitType)
      const emb = await embedding(content)
      assertEmbeddingDim(emb, `visual index unit ${unit.sourceImageId}`)

      await sql`
        insert into public.document_index_units (
          owner_id,
          document_id,
          unit_type,
          source_chunk_id,
          source_image_id,
          page_start,
          page_end,
          heading_path,
          title,
          content,
          normalized_terms,
          source_span,
          quality_score,
          extraction_mode,
          embedding,
          metadata
        ) values (
          ${job.documents.owner_id}::uuid,
          ${job.document_id}::uuid,
          ${unitType},
          null,
          ${unit.sourceImageId}::uuid,
          ${unit.page},
          ${unit.page},
          '{}'::text[],
          ${unit.title},
          ${content},
          ${unit.normalizedTerms}::text[],
          null,
          ${unit.qualityScore},
          'hybrid',
          ${JSON.stringify(emb)}::vector,
          ${JSON.stringify({ ...unit.metadata, visual_unit_type: unit.unitType, generated_by: GENERATED_BY })}::jsonb
        )
      `
      createdUnits += 1

      const fieldType = canonicalFieldType(unit.unitType)
      const contentHash = await sha256Hex(content)
      assertEmbeddingDim(emb, `visual embedding field ${unit.sourceImageId}`)

      await sql`
        insert into public.document_embedding_fields (
          owner_id,
          document_id,
          source_chunk_id,
          field_type,
          content,
          embedding,
          metadata,
          content_hash
        ) values (
          ${job.documents.owner_id}::uuid,
          ${job.document_id}::uuid,
          null,
          ${fieldType},
          ${content},
          ${JSON.stringify(emb)}::vector,
          ${JSON.stringify({ source_image_id: unit.sourceImageId, visual_field_type: unit.unitType, generated_by: GENERATED_BY })}::jsonb,
          ${contentHash}
        )
      `
      createdFields += 1
    }
  }

  return { selected_images: selected.length, created_units: createdUnits, created_fields: createdFields }
}

async function upsertCoreEmbeddingFields(job: ClaimedJob, summary: string): Promise<number> {
  const title = normalizeText(job.documents.title ?? '') || 'Untitled document'
  const base = [
    { field_type: 'document_title', content: title },
    { field_type: 'document_summary', content: normalizeText(summary) || 'Summary unavailable' },
  ]

  await sql`
    delete from public.document_embedding_fields
    where document_id = ${job.document_id}::uuid
      and field_type = any(${base.map((b) => b.field_type)}::text[])
      and metadata->>'generated_by' = ${GENERATED_BY}
  `

  let inserted = 0
  for (const row of base) {
    const emb = await embedding(row.content)
    const contentHash = await sha256Hex(row.content)
    assertEmbeddingDim(emb, `${row.field_type} embedding field`)

    await sql`
      insert into public.document_embedding_fields (
        owner_id, document_id, source_chunk_id, field_type, content, embedding, metadata, content_hash
      ) values (
        ${job.documents.owner_id}::uuid,
        ${job.document_id}::uuid,
        null,
        ${row.field_type},
        ${row.content},
        ${JSON.stringify(emb)}::vector,
        ${JSON.stringify({ generated_by: GENERATED_BY })}::jsonb,
        ${contentHash}
      )
    `
    inserted += 1
  }

  return inserted
}

async function updateQuality(job: ClaimedJob): Promise<void> {
  const counts = await sql<{
    visual_units: number
    anchors_with_image: number
    total_units: number
    visual_images: number
  }[]>`
    with unit_counts as (
      select
        count(*) filter (where metadata->>'generated_by' = ${GENERATED_BY})::int as visual_units,
        count(*) filter (where source_image_id is not null)::int as anchors_with_image,
        count(*)::int as total_units
      from public.document_index_units
      where document_id = ${job.document_id}::uuid
    ),
    image_counts as (
      select count(*)::int as visual_images
      from public.document_images
      where document_id = ${job.document_id}::uuid
        and coalesce(searchable,false)=true
        and coalesce(image_type,'unclear') <> 'logo_decorative'
    )
    select
      u.visual_units,
      u.anchors_with_image,
      u.total_units,
      i.visual_images
    from unit_counts u, image_counts i
  `

  const c = counts[0]
  const typedCoverage = c.total_units > 0 ? c.visual_units / c.total_units : 0
  const anchorCoverage = c.total_units > 0 ? c.anchors_with_image / c.total_units : 0
  const retrievableVisualHit = c.visual_units > 0 && c.visual_images > 0

  await sql`
    insert into public.document_index_quality (
      document_id,
      owner_id,
      quality_score,
      extraction_quality,
      metrics,
      issues,
      updated_at
    ) values (
      ${job.document_id}::uuid,
      ${job.documents.owner_id}::uuid,
      ${Math.max(0, Math.min(1, 0.55 + typedCoverage * 0.25 + anchorCoverage * 0.2))},
      'partial',
      ${JSON.stringify({
        indexing_v3_agent: {
          visual_units: c.visual_units,
          total_units: c.total_units,
          visual_images: c.visual_images,
          retrievable_visual_hit: retrievableVisualHit,
          typed_unit_coverage: typedCoverage,
          anchor_coverage: anchorCoverage,
          source_span_coverage: anchorCoverage,
          model_fallback_rate: 0,
          noisy_unit_rate: Math.max(0, 1 - typedCoverage),
        },
      })}::jsonb,
      ${retrievableVisualHit ? [] : ['no retrievable visual evidence']}::text[],
      now()
    )
    on conflict (document_id)
    do update set
      quality_score = greatest(public.document_index_quality.quality_score, excluded.quality_score),
      extraction_quality = case
        when public.document_index_quality.extraction_quality in ('good', 'partial') then public.document_index_quality.extraction_quality
        else excluded.extraction_quality
      end,
      metrics = coalesce(public.document_index_quality.metrics, '{}'::jsonb) || excluded.metrics,
      issues = coalesce((
        select array_agg(distinct issue order by issue)
        from unnest(coalesce(public.document_index_quality.issues, '{}'::text[]) || excluded.issues) as issue
      ), '{}'::text[]),
      updated_at = now()
  `
}

async function completionGate(job: ClaimedJob): Promise<CompletionGate> {
  const rows = await sql<Array<{
    sections: number
    memory_cards: number
    generated_labels: number
    index_units: number
    title_embedding: boolean
    summary_embedding: boolean
  }>>`
    select
      (select count(*)::int from public.document_sections where document_id = ${job.document_id}::uuid) as sections,
      (select count(*)::int from public.document_memory_cards where document_id = ${job.document_id}::uuid) as memory_cards,
      (
        select count(*)::int from public.document_labels
        where document_id = ${job.document_id}::uuid
          and (
            lower(source) = 'generated'
            or metadata->>'source' = 'generated'
            or metadata->>'generated_by' = 'local-worker'
            or metadata->>'generated_by' = ${GENERATED_BY}
          )
      ) as generated_labels,
      (select count(*)::int from public.document_index_units where document_id = ${job.document_id}::uuid) as index_units,
      exists (
        select 1 from public.document_embedding_fields
        where document_id = ${job.document_id}::uuid
          and field_type = 'document_title'
        limit 1
      ) as title_embedding,
      exists (
        select 1 from public.document_embedding_fields
        where document_id = ${job.document_id}::uuid
          and field_type = 'document_summary'
        limit 1
      ) as summary_embedding
  `
  const row = rows[0]
  const missing = [
    row.sections > 0 ? null : 'sections',
    row.memory_cards > 0 ? null : 'memory_cards',
    row.generated_labels > 0 ? null : 'generated_labels',
    row.index_units > 0 ? null : 'index_units',
    row.title_embedding ? null : 'title_embedding',
    row.summary_embedding ? null : 'summary_embedding',
  ].filter((value): value is string => Boolean(value))

  return {
    counts: {
      sections: row.sections,
      memory_cards: row.memory_cards,
      generated_labels: row.generated_labels,
      index_units: row.index_units,
    },
    presence: {
      title_embedding: row.title_embedding,
      summary_embedding: row.summary_embedding,
    },
    missing,
    result: missing.length === 0 ? 'complete' : 'deferred',
  }
}

function logCompletionGate(job: ClaimedJob, gate: CompletionGate): void {
  console.log(JSON.stringify({
    event: 'completion_gate',
    worker: GENERATED_BY,
    job_id: job.id,
    document_id: job.document_id,
    counts: gate.counts,
    presence: gate.presence,
    result: gate.result,
    missing: gate.missing,
  }))
}

async function deferJob(job: ClaimedJob, gate: CompletionGate): Promise<void> {
  const details = {
    code: 'completion_gate_deferred',
    missing: gate.missing,
    counts: gate.counts,
    presence: gate.presence,
  }

  await sql.begin(async (tx) => {
    await tx`
      update public.documents
      set
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'indexing_v3_agent_status', 'deferred',
            'indexing_v3_agent_version', 'visual-core-v3',
            'indexing_v3_agent_updated_at', now(),
            'completion_gate', ${JSON.stringify(details)}::jsonb,
            'completion_gate_missing', ${JSON.stringify(gate.missing)}::jsonb,
            'enrichment_status', 'pending'
          ),
        updated_at = now()
      where id = ${job.document_id}::uuid
    `

    await tx`
      update public.ingestion_jobs
      set
        status = 'pending',
        stage = 'deferred: missing enrichment artifacts',
        progress = greatest(progress, 95),
        attempt_count = greatest(attempt_count - 1, 0),
        error_message = ${JSON.stringify(details)},
        locked_at = null,
        locked_by = null,
        next_run_at = now() + interval '15 minutes',
        completed_at = null
      where id = ${job.id}::uuid
        and document_id = ${job.document_id}::uuid
    `
  })
}

async function completeJob(job: ClaimedJob): Promise<void> {
  await sql`
    update public.documents
    set
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'indexing_v3_agent_status', 'completed',
          'indexing_v3_agent_version', 'visual-core-v3',
          'indexing_v3_agent_updated_at', now(),
          'visual_indexing_version', 'visual-v3',
          'enrichment_status', 'completed'
        ),
      updated_at = now()
    where id = ${job.document_id}::uuid
  `

  await sql`
    select public.complete_ingestion_job(
      ${job.id}::uuid,
      ${job.document_id}::uuid,
      ${job.batch_id ?? null}::uuid,
      'indexed + enrichment backfill v3'
    )
  `
}

async function processJob(job: ClaimedJob): Promise<{ status: 'completed' | 'deferred'; missing: string[] }> {
  const s1 = await stageStart(job, 'summary_and_core_embeddings')
  try {
    const summary = await ensureSummary(job)
    const coreFields = await upsertCoreEmbeddingFields(job, summary)
    await stageFinish(s1, true, { core_embedding_fields: coreFields })
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    await stageFinish(s1, false, {}, msg)
    throw e
  }

  const s2 = await stageStart(job, 'visual_priority_and_structured_extraction')
  try {
    const out = await upsertVisualArtifacts(job)
    await stageFinish(s2, true, out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    await stageFinish(s2, false, {}, msg)
    throw e
  }

  const s3 = await stageStart(job, 'quality_refresh')
  try {
    const sectionUnits = await upsertSectionIndexUnits(job)
    await updateQuality(job)
    await stageFinish(s3, true, { section_index_units: sectionUnits })
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e)
    await stageFinish(s3, false, {}, msg)
    throw e
  }

  let gate = await completionGate(job)
  if (gate.missing.includes('generated_labels')) {
    await upsertGeneratedLabelsFromParsedArtifacts(job)
    gate = await completionGate(job)
  }
  logCompletionGate(job, gate)
  if (gate.result === 'deferred') {
    await deferJob(job, gate)
    return { status: 'deferred', missing: gate.missing }
  }

  await completeJob(job)
  return { status: 'completed', missing: [] }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 })
    }
    const unauthorized = authorizeRequest(req)
    if (unauthorized) return unauthorized

    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? '8')))
    const workerId = `indexing-v3-agent-${crypto.randomUUID()}`

    const claimed = await sql<ClaimedJob[]>`
      select * from public.claim_ingestion_jobs(${workerId}, ${limit}, 45)
    `

    if (claimed.length === 0) {
      return Response.json({ ok: true, claimed: 0, processed: 0, failed: 0 })
    }

    let processed = 0
    let deferred = 0
    let failed = 0
    const failures: Array<{ job_id: string; document_id: string; error: string }> = []
    const deferrals: Array<{ job_id: string; document_id: string; missing: string[] }> = []

    for (const job of claimed) {
      try {
        const result = await processJob(job)
        if (result.status === 'completed') {
          processed += 1
        } else {
          deferred += 1
          deferrals.push({ job_id: job.id, document_id: job.document_id, missing: result.missing })
        }
      } catch (e) {
        failed += 1
        const msg = e instanceof Error ? e.message : JSON.stringify(e)
        failures.push({ job_id: job.id, document_id: job.document_id, error: msg })
        const shouldRetry = job.attempt_count < job.max_attempts

        await sql`
          select public.fail_or_retry_ingestion_job(
            ${job.id}::uuid,
            ${job.document_id}::uuid,
            ${job.batch_id ?? null}::uuid,
            ${shouldRetry},
            'indexed',
            'v3 enrichment failed',
            ${msg},
            ${new Date(Date.now() + 120_000).toISOString()}::timestamptz
          )
        `
      }
    }

    return Response.json({
      ok: true,
      worker: workerId,
      claimed: claimed.length,
      processed,
      deferred,
      failed,
      deferrals,
      failures,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : JSON.stringify(e)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
})
