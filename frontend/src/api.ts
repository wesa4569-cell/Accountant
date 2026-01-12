export type ApiError = { detail?: string } | string;

const API_BASE = '/api';

function safeJsonParse(raw: string): any {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- Auth Types ---
export type LoginRequest = { username: string; password: string }; // OAuth2PasswordRequestForm expects username
export type RegisterRequest = { email: string; password: string; full_name: string; role: string; tenant_id?: string };
export type TokenResponse = { access_token: string; token_type: string };
export type User = { id: string; email: string; full_name: string; role: string; is_active: boolean; created_at: string };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const body = (options as any).body;

  // Add Auth Token if available
  const token = localStorage.getItem('token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  // Default headers
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  // Do NOT force Content-Type for FormData (browser sets boundary).
  // If sending JSON string and caller didn't set Content-Type, set it.
  if (!isFormData && typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Handle 401: Clear token and reload/redirect
  if (res.status === 401 && path !== '/auth/token') {
    localStorage.removeItem('token');
    window.location.reload();
    throw new Error('Unauthorized');
  }

  // ✅ Read body ONCE (fixes: body stream already read)
  const ct = res.headers.get('content-type') || '';
  const raw = await res.text();

  if (!res.ok) {
    let message = res.statusText || `HTTP ${res.status}`;

    if (ct.includes('application/json')) {
      const j = safeJsonParse(raw);
      if (typeof j === 'string' && j) message = j;
      else if (j && typeof j === 'object') message = j.detail || j.message || message;
      else if (raw) message = raw;
    } else if (raw) {
      message = raw;
    }

    throw new Error(message);
  }

  if (res.status === 204) return undefined as unknown as T;

  if (ct.includes('application/json')) {
    return (raw ? JSON.parse(raw) : null) as T;
  }

  return raw as unknown as T;
}

export type Tenant = { id: string; name: string; created_at: string };

export type Case = { id: string; tenant_id: string; title: string; description?: string; court_circuit?: string; case_no?: string; created_at: string };
export type Party = { id: string; case_id: string; name: string; role: 'company_a' | 'company_b' | 'other'; lawyer?: string; created_at: string };
export type Procedure = { id: string; case_id: string; date: string; description_en: string; description_ar: string; created_at: string };
export type FileItem = { id: string; case_id: string; filename: string; content_type: string; kind: 'document' | 'ledger'; created_at: string };
export type Extraction = { file_id: string; text: string; meta?: any; created_at: string };

export type LedgerImport = { id: string; case_id: string; party_id: string; file_id: string; mapping?: any; created_at: string };

export type ReconciliationSummary = { run_id: string; matched: number; unmatched_a: number; unmatched_b: number; total_variance: number };
export type ReconciliationRow = {
  id: string; run_id: string; side: 'A' | 'B' | 'MATCH';
  invoice_no?: string; date_text?: string;
  amount_a?: number; amount_b?: number; variance?: number;
  match_rule?: string; evidence?: any; created_at: string;
};

export type Settlement = { id: string; case_id: string; run_id: string; net_payable_to_a: number; net_payable_to_b: number; created_at: string };
export type SettlementLine = { id: string; settlement_id: string; invoice_no?: string; date_text?: string; amount_a?: number; amount_b?: number; variance?: number; classification: string; notes?: string; evidence_ids?: string[]; created_at: string };
export type Adjustment = { id: string; case_id: string; settlement_id: string; description: string; debit_party_id?: string; credit_party_id?: string; amount: number; justification?: string; evidence_ids?: string[]; created_at: string };

export type FrameworkInfo = { code: string; title_en: string; title_ar: string; description_en: string; description_ar: string };
export type CaseFramework = { framework_code: string; enabled: boolean };

export type StandardLibraryItem = { framework_code: string; standard_code: string; title_en: string; title_ar: string; description_en?: string; description_ar?: string };

export type ChecklistItem = {
  id: string; case_id: string; framework_code: string; standard_code: string;
  requirement_en: string; requirement_ar: string;
  status: 'pending' | 'pass' | 'fail' | 'na';
  notes?: string; evidence_ids?: string[]; updated_at: string;
};

export type Evidence = {
  id: string; case_id: string; title: string; evidence_type: string;
  source_file_id?: string; page_no?: number; row_index?: number;
  excerpt_text?: string; meta?: any; created_at: string;
};

export type Finding = {
  id: string; case_id: string; framework_code: string;
  title_en: string; title_ar: string;
  description_en?: string; description_ar?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  standard_refs?: string[]; evidence_ids?: string[];
  created_at: string;
};

export const api = {
  listTenants: () => request<Tenant[]>('/tenants'),

  listCases: () => request<Case[]>('/cases'),
  createCase: (title: string, description?: string, court_circuit?: string, case_no?: string, tenant_id?: string) =>
    request<Case>('/cases', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, description, court_circuit, case_no, tenant_id }) }),
  updateCase: (id: string, title: string, description?: string, court_circuit?: string, case_no?: string) =>
    request<Case>(`/cases/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, description, court_circuit, case_no }) }),
  deleteCase: (id: string) => request<void>(`/cases/${id}`, { method: 'DELETE' }),

  listProcedures: (caseId: string) => request<Procedure[]>(`/cases/${caseId}/procedures`),
  createProcedure: (caseId: string, date: string, description_en: string, description_ar: string) =>
    request<Procedure>(`/cases/${caseId}/procedures`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ date, description_en, description_ar }) }),
  deleteProcedure: (id: string) => request<void>(`/procedures/${id}`, { method: 'DELETE' }),

  // Auth
  login: (data: LoginRequest) => {
    // OAuth2PasswordRequestForm expects form-data encoded body
    const fd = new FormData();
    fd.append('username', data.username);
    fd.append('password', data.password);
    return request<TokenResponse>('/auth/token', { method: 'POST', body: fd });
  },
  register: (data: RegisterRequest) => request<User>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request<User>('/auth/me'),

  listParties: (caseId: string) => request<Party[]>(`/cases/${caseId}/parties`),
  addParty: (caseId: string, name: string, role: Party['role'], lawyer?: string) =>
    request<Party>(`/cases/${caseId}/parties`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, role, lawyer }) }),
  updateParty: (id: string, name?: string, role?: Party['role'], lawyer?: string) =>
    request<Party>(`/parties/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, role, lawyer }) }),


  listFiles: (caseId: string) => request<FileItem[]>(`/cases/${caseId}/files`),
  uploadFile: async (caseId: string, kind: 'document' | 'ledger', file: File) => {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('file', file);
    return request<FileItem>(`/cases/${caseId}/files`, { method: 'POST', body: fd });
  },
  deleteFile: (fileId: string) => request<void>(`/files/${fileId}`, { method: 'DELETE' }),
  getExtraction: (fileId: string) => request<Extraction>(`/files/${fileId}/extraction`),

  importLedger: async (caseId: string, partyId: string, file: File) => {
    const fd = new FormData();
    fd.append('party_id', partyId);
    fd.append('file', file);
    return request<LedgerImport>(`/cases/${caseId}/ledgers/import`, { method: 'POST', body: fd });
  },
  listLedgerImports: (caseId: string) => request<LedgerImport[]>(`/cases/${caseId}/ledgers/imports`),

  runReconciliation: (caseId: string, importAId: string, importBId: string, toleranceAmount: number, toleranceDays: number) =>
    request<ReconciliationSummary>(`/cases/${caseId}/reconciliation/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ import_a_id: importAId, import_b_id: importBId, tolerance_amount: toleranceAmount, tolerance_days: toleranceDays })
    }),
  getReconciliationRows: (runId: string) => request<ReconciliationRow[]>(`/reconciliation/runs/${runId}/rows`),

  generateSettlement: (caseId: string, runId: string) =>
    request<Settlement>(`/cases/${caseId}/settlement`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ run_id: runId }) }),
  listSettlementLines: (settlementId: string) => request<SettlementLine[]>(`/settlements/${settlementId}/lines`),

  createAdjustment: (settlementId: string, payload: { description: string; amount: number; debit_party_id?: string; credit_party_id?: string; justification?: string; evidence_ids?: string[] }) =>
    request<Adjustment>(`/settlements/${settlementId}/adjustments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
  listAdjustments: (settlementId: string) => request<Adjustment[]>(`/settlements/${settlementId}/adjustments`),

  listFrameworks: () => request<FrameworkInfo[]>(`/frameworks`),
  getCaseFrameworks: (caseId: string) => request<CaseFramework[]>(`/cases/${caseId}/frameworks`),
  setCaseFrameworks: (caseId: string, frameworks: CaseFramework[]) =>
    request<CaseFramework[]>(`/cases/${caseId}/frameworks`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ frameworks }) }),

  standardsLibrary: (framework_code?: string) =>
    request<StandardLibraryItem[]>(`/standards/library${framework_code ? `?framework_code=${encodeURIComponent(framework_code)}` : ''}`),

  seedChecklists: (caseId: string) => request<{ seeded: number }>(`/cases/${caseId}/checklists/seed`, { method: 'POST' }),
  listChecklists: (caseId: string, framework_code?: string) =>
    request<ChecklistItem[]>(`/cases/${caseId}/checklists${framework_code ? `?framework_code=${encodeURIComponent(framework_code)}` : ''}`),
  patchChecklist: (itemId: string, payload: Partial<Pick<ChecklistItem, 'status' | 'notes' | 'evidence_ids'>>) =>
    request<ChecklistItem>(`/checklists/${itemId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),

  createEvidence: (caseId: string, payload: { title: string; evidence_type: 'document' | 'ledger' | 'note' | 'other'; source_file_id?: string; page_no?: number; row_index?: number; excerpt_text?: string; meta?: any }) =>
    request<Evidence>(`/cases/${caseId}/evidence`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
  listEvidence: (caseId: string) => request<Evidence[]>(`/cases/${caseId}/evidence`),

  createFinding: (caseId: string, payload: { framework_code: string; title_en: string; title_ar: string; description_en?: string; description_ar?: string; severity: 'low' | 'medium' | 'high' | 'critical'; standard_refs?: string[]; evidence_ids?: string[] }) =>
    request<Finding>(`/cases/${caseId}/findings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
  listFindings: (caseId: string, framework_code?: string) =>
    request<Finding[]>(`/cases/${caseId}/findings${framework_code ? `?framework_code=${encodeURIComponent(framework_code)}` : ''}`),

  exportReport: async (caseId: string, runId: string, settlementId: string, format: 'docx' | 'pdf', lang: 'en' | 'ar' | 'bi') => {
    const res = await fetch(`${API_BASE}/cases/${caseId}/report/export?run_id=${encodeURIComponent(runId)}&settlement_id=${encodeURIComponent(settlementId)}&format=${format}&lang=${lang}`);
    if (!res.ok) {
      // read ONCE here as well
      const raw = await res.text();
      throw new Error(raw || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expert-report-${caseId}-${lang}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  getAudit: (caseId: string) => request<any[]>(`/cases/${caseId}/audit`)
};
