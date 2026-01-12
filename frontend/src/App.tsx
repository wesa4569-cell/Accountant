import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, Case, FileItem, Party, LedgerImport, ReconciliationRow, ReconciliationSummary, Settlement, SettlementLine, FrameworkInfo, CaseFramework, ChecklistItem, Evidence, Finding, Adjustment, User } from './api';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';

type Tab =
  | 'cases'
  | 'general'
  | 'procedures'
  | 'docs'
  | 'accounting'
  | 'report'
  | 'audit';

function roleLabel(role: Party['role'], t: any) {
  if (role === 'company_a') return t('company_a');
  if (role === 'company_b') return t('company_b');
  return t('other');
}

function FrameworkName({ f, lang }: { f: FrameworkInfo; lang: string }) {
  return <span>{lang === 'ar' ? f.title_ar : f.title_en}</span>;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);

  const [tab, setTab] = useState<Tab>('cases');
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const [parties, setParties] = useState<Party[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [imports, setImports] = useState<LedgerImport[]>([]);

  const [reconSummary, setReconSummary] = useState<ReconciliationSummary | null>(null);
  const [reconRows, setReconRows] = useState<ReconciliationRow[]>([]);
  const [importA, setImportA] = useState<string>('');
  const [importB, setImportB] = useState<string>('');
  const [tolAmount, setTolAmount] = useState<number>(1.0);
  const [tolDays, setTolDays] = useState<number>(3);

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [settlementLines, setSettlementLines] = useState<SettlementLine[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  const [frameworkInfos, setFrameworkInfos] = useState<FrameworkInfo[]>([]);
  const [caseFrameworks, setCaseFrameworks] = useState<CaseFramework[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]); // New State

  const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId) || null, [cases, selectedCaseId]);

  async function refreshCases() {
    const cs = await api.listCases();
    setCases(cs);
    if (!selectedCaseId && cs.length) setSelectedCaseId(cs[0].id);
  }

  async function refreshCaseData(caseId: string) {
    const [ps, fs, imps, procs] = await Promise.all([
      api.listParties(caseId),
      api.listFiles(caseId),
      api.listLedgerImports(caseId),
      api.listProcedures(caseId),
    ]);
    setParties(ps);
    setFiles(fs);
    setImports(imps);
    setProcedures(procs);

    const [fws, cls, evs, fns, aud] = await Promise.all([
      api.getCaseFrameworks(caseId),
      api.listChecklists(caseId).catch(() => [] as any),
      api.listEvidence(caseId).catch(() => [] as any),
      api.listFindings(caseId).catch(() => [] as any),
      api.getAudit(caseId).catch(() => [] as any),
    ]);
    setCaseFrameworks(fws);
    setChecklists(cls);
    setEvidence(evs);
    setFindings(fns);
    setAudit(aud);
  }

  useEffect(() => {
    (async () => {
      const fws = await api.listFrameworks();
      setFrameworkInfos(fws);
      await refreshCases();
    })().catch(err => alert(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCaseId) return;
    refreshCaseData(selectedCaseId).catch(err => alert(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCaseId]);

  const enabledFrameworkCodes = useMemo(() => new Set(caseFrameworks.filter(x => x.enabled).map(x => x.framework_code)), [caseFrameworks]);

  async function doRunReconciliation() {
    if (!selectedCaseId) return;
    const sum = await api.runReconciliation(selectedCaseId, importA, importB, tolAmount, tolDays);
    setReconSummary(sum);
    const rows = await api.getReconciliationRows(sum.run_id);
    setReconRows(rows);
    setSettlement(null);
    setSettlementLines([]);
    setAdjustments([]);
  }

  async function doGenerateSettlement() {
    if (!selectedCaseId || !reconSummary) return;
    const s = await api.generateSettlement(selectedCaseId, reconSummary.run_id);
    setSettlement(s);
    const lines = await api.listSettlementLines(s.id);
    setSettlementLines(lines);
    const adjs = await api.listAdjustments(s.id);
    setAdjustments(adjs);
  }

  async function doSeedChecklists() {
    if (!selectedCaseId) return;
    await api.seedChecklists(selectedCaseId);
    const cls = await api.listChecklists(selectedCaseId);
    setChecklists(cls);
  }

  async function doSaveFrameworks(next: CaseFramework[]) {
    if (!selectedCaseId) return;
    const res = await api.setCaseFrameworks(selectedCaseId, next);
    setCaseFrameworks(res);
    await doSeedChecklists().catch(() => { });
  }

  async function doPatchChecklist(itemId: string, payload: any) {
    const updated = await api.patchChecklist(itemId, payload);
    setChecklists(prev => prev.map(x => (x.id === updated.id ? updated : x)));
  }

  /* TABS DEFINITION */
  const tabs: { id: Tab; label: string }[] = [
    { id: 'cases', label: t('cases') },
    { id: 'general', label: '1. General / عام' },
    { id: 'procedures', label: '3. Procedures / الإجراءات' },
    { id: 'docs', label: 'Docs / المستندات' },
    { id: 'accounting', label: '4. Accounting / الحسابات' },
    { id: 'report', label: 'Final Report / التقرير' },
  ];




  // Auth Flow
  useEffect(() => {
    if (token) {
      api.getMe().then(setUser).catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      });
    }
  }, [token]);

  if (!token) {
    if (authView === 'register') {
      return <RegisterPage onRegistered={() => setAuthView('login')} onCancel={() => setAuthView('login')} />;
    }
    return <LoginPage onLogin={() => setToken(localStorage.getItem('token'))} onGoRegister={() => setAuthView('register')} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="title">{t('app_title')}</div>
          <div className="subtitle">{t('subtitle')} {user && <span style={{ fontSize: '0.8em', opacity: 0.8 }}>— {user.email}</span>}</div>
        </div>
        <div className="headerRight">
          <button className="btn" onClick={() => {
            localStorage.removeItem('token');
            setToken(null);
            window.location.reload();
          }}>Logout</button>
          <div className="langRow">
            <label className="label">{t('language')}</label>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="select"
            >
              <option value="en">{t('english')}</option>
              <option value="ar">{t('arabic')}</option>
            </select>
          </div>

          <div className="casePicker">
            <label className="label">{t('case')}</label>
            <select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)} className="select">
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.id.slice(0, 8)})
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => refreshCaseData(selectedCaseId).catch(err => alert(err.message))}>
              {t('refresh')}
            </button>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((x) => (
          <button key={x.id} className={tab === x.id ? 'tab active' : 'tab'} onClick={() => setTab(x.id)}>
            {x.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {!selectedCase && tab !== 'cases' && (
          <div className="card">{t('select_case_first')}</div>
        )}

        {tab === 'cases' && (
          <CasesTab
            cases={cases}
            selectedCaseId={selectedCaseId}
            setSelectedCaseId={setSelectedCaseId}
            onCreated={async () => refreshCases()}
            t={t}
          />
        )}

        {selectedCase && tab === 'general' && (
          <GeneralTab caseData={selectedCase} parties={parties} onUpdate={() => refreshCases()} onRefresh={() => refreshCaseData(selectedCase.id)} t={t} />
        )}

        {selectedCase && tab === 'procedures' && (
          <ProceduresTab caseId={selectedCase.id} procedures={procedures} onRefresh={() => refreshCaseData(selectedCase.id)} t={t} />
        )}

        {selectedCase && tab === 'docs' && (
          <div className="vertical-stack">
            <DocumentsTab caseId={selectedCase.id} files={files} onRefresh={() => refreshCaseData(selectedCase.id)} t={t} />
            <div className="divider" />
            <EvidenceTab caseId={selectedCase.id} evidence={evidence} files={files} onAdd={async (pl: any) => { await api.createEvidence(selectedCase.id, pl); refreshCaseData(selectedCase.id); }} t={t} />
          </div>
        )}

        {selectedCase && tab === 'accounting' && (
          <div className="vertical-stack">
            <LedgersTab caseId={selectedCase.id} parties={parties} imports={imports} onRefresh={() => refreshCaseData(selectedCase.id)} t={t} />
            <div className="divider" />
            <ReconciliationTab
              imports={imports} importA={importA} setImportA={setImportA}
              importB={importB} setImportB={setImportB}
              tolAmount={tolAmount} setTolAmount={setTolAmount}
              tolDays={tolDays} setTolDays={setTolDays}
              onRun={doRunReconciliation} reconSummary={reconSummary} reconRows={reconRows} t={t}
            />
            <div className="divider" />
            <SettlementTab
              parties={parties} settlement={settlement} settlementLines={settlementLines} adjustments={adjustments}
              onGenerate={doGenerateSettlement}
              onAddAdjustment={async (pl: any) => {
                if (!settlement) return;
                await api.createAdjustment(settlement.id, pl);
                doGenerateSettlement();
              }}
              t={t}
            />
          </div>
        )}

        {selectedCase && tab === 'report' && (
          <ReportTab
            caseId={selectedCase.id}
            runId={reconSummary?.run_id || ''}
            settlementId={settlement?.id || ''}
            t={t}
          />
        )}
      </main>

      <footer className="footer">
        <span className="muted">{t('methodology_notice')}</span>
      </footer>
    </div>
  );
}

function CasesTab({ cases, selectedCaseId, setSelectedCaseId, onCreated, t }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');

  async function deleteCase(id: string) {
    if (!confirm(t('confirm_delete') || 'Are you sure?')) return;
    try {
      await api.deleteCase(id);
      if (selectedCaseId === id) setSelectedCaseId('');
      onCreated();
    } catch (e: any) { alert(e.message); }
  }

  function startEdit(c: Case) {
    setIsEditing(true);
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description || '');
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditingId('');
    setTitle('');
    setDescription('');
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('cases')}</div>
        <div className="row">
          <select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)} className="select grow">
            {cases.map((c: Case) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => onCreated().catch((err: any) => alert(err.message))}>{t('refresh')}</button>

          {selectedCaseId && (
            <>
              <button className="btn" onClick={() => {
                const c = cases.find((x: Case) => x.id === selectedCaseId);
                if (c) startEdit(c);
              }}>{t('edit') || 'Edit'}</button>
              <button className="btn" style={{ color: '#ff6a6a', borderColor: '#ff6a6a' }} onClick={() => deleteCase(selectedCaseId)}>{t('delete') || 'Delete'}</button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">{t('create_case')}</div>
        <div className="field">
          <label className="label">{t('title')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">{t('description')}</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button
          className="btn primary"
          onClick={async () => {
            if (!title.trim()) return;
            try {
              if (isEditing) {
                await api.updateCase(editingId, title.trim(), description.trim() || undefined);
                cancelEdit();
              } else {
                await api.createCase(title.trim(), description.trim() || undefined);
                setTitle('');
                setDescription('');
              }
              await onCreated();
            } catch (e: any) { alert(e.message); }
          }}
        >
          {isEditing ? (t('save') || 'Save') : t('create')}
        </button>
        {isEditing && <button className="btn" onClick={cancelEdit}>{t('cancel') || 'Cancel'}</button>}

      </div>
    </div >
  );
}

function DocumentsTab({ caseId, files, onRefresh, t }: any) {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [extractionText, setExtractionText] = useState<string>('');

  useEffect(() => {
    if (!selectedFileId && files.length) setSelectedFileId(files[0].id);
  }, [files, selectedFileId]);

  async function loadExtraction() {
    if (!selectedFileId) return;
    const ex = await api.getExtraction(selectedFileId);
    setExtractionText(ex.text);
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('upload_document')}</div>
        <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
        <button
          className="btn primary"
          onClick={async () => {
            if (!docFile) return;
            await api.uploadFile(caseId, 'document', docFile);
            setDocFile(null);
            await onRefresh();
          }}
        >
          {t('upload')}
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">{t('documents')}</div>
        <div className="row">
          <select className="select grow" value={selectedFileId} onChange={(e) => setSelectedFileId(e.target.value)}>
            {files.filter((f: FileItem) => f.kind === 'document').map((f: FileItem) => (
              <option key={f.id} value={f.id}>
                {f.filename}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => loadExtraction().catch(err => alert(err.message))}>{t('refresh')}</button>
          {selectedFileId && (
            <button className="btn" style={{ color: '#ff6a6a', borderColor: '#ff6a6a' }} onClick={async () => {
              if (!confirm(t('confirm_delete') || 'Delete file?')) return;
              try {
                await api.deleteFile(selectedFileId);
                setSelectedFileId('');
                onRefresh();
              } catch (e: any) { alert(e.message); }
            }}>{t('delete') || 'Delete'}</button>
          )}
        </div>
        <textarea className="textarea mono" value={extractionText} readOnly rows={16} />
      </div>
    </div>
  );
}

function LedgersTab({ caseId, parties, imports, onRefresh, t }: any) {
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [partyId, setPartyId] = useState<string>('');

  useEffect(() => {
    if (!partyId && parties.length) setPartyId(parties[0].id);
  }, [parties, partyId]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('import_ledger')}</div>
        <div className="field">
          <label className="label">{t('party')}</label>
          <select className="select" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            {parties.map((p: Party) => (
              <option key={p.id} value={p.id}>
                {roleLabel(p.role, t)} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <input type="file" accept=".xlsx,.xlsm,.xls" onChange={(e) => setLedgerFile(e.target.files?.[0] || null)} />
        <button
          className="btn primary"
          onClick={async () => {
            if (!ledgerFile || !partyId) return;
            await api.importLedger(caseId, partyId, ledgerFile);
            setLedgerFile(null);
            await onRefresh();
          }}
        >
          {t('upload')}
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">{t('ledgers')}</div>
        <div className="muted">Imports: {imports.length}</div>
        <ul className="list">
          {imports.map((imp: LedgerImport) => (
            <li key={imp.id} className="listItem">
              <div className="mono">{imp.id.slice(0, 8)}</div>
              <div className="muted">{imp.created_at}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReconciliationTab({ imports, importA, setImportA, importB, setImportB, tolAmount, setTolAmount, tolDays, setTolDays, onRun, reconSummary, reconRows, t }: any) {
  useEffect(() => {
    if (!importA && imports.length) setImportA(imports[0].id);
    if (!importB && imports.length > 1) setImportB(imports[1].id);
  }, [imports, importA, importB, setImportA, setImportB]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('run_reconciliation')}</div>
        <div className="field">
          <label className="label">Import A</label>
          <select className="select" value={importA} onChange={(e) => setImportA(e.target.value)}>
            {imports.map((imp: LedgerImport) => (
              <option key={imp.id} value={imp.id}>{imp.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Import B</label>
          <select className="select" value={importB} onChange={(e) => setImportB(e.target.value)}>
            {imports.map((imp: LedgerImport) => (
              <option key={imp.id} value={imp.id}>{imp.id.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <div className="field grow">
            <label className="label">{t('tolerance_amount')}</label>
            <input className="input" type="number" value={tolAmount} onChange={(e) => setTolAmount(parseFloat(e.target.value))} />
          </div>
          <div className="field grow">
            <label className="label">{t('tolerance_days')}</label>
            <input className="input" type="number" value={tolDays} onChange={(e) => setTolDays(parseInt(e.target.value || '0', 10))} />
          </div>
        </div>
        <button className="btn primary" onClick={onRun} disabled={!importA || !importB || importA === importB}>
          {t('run_reconciliation')}
        </button>

        {reconSummary && (
          <div className="kv">
            <div>Run ID: <span className="mono">{reconSummary.run_id.slice(0, 12)}</span></div>
            <div>Matched: {reconSummary.matched}</div>
            <div>Unmatched A: {reconSummary.unmatched_a}</div>
            <div>Unmatched B: {reconSummary.unmatched_b}</div>
            <div>Total variance: {reconSummary.total_variance}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardTitle">Rows</div>
        <div className="muted">Showing {Math.min(200, reconRows.length)} / {reconRows.length}</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Side</th><th>Invoice</th><th>Date</th><th>A</th><th>B</th><th>Var</th><th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {reconRows.slice(0, 200).map((r: ReconciliationRow) => (
                <tr key={r.id}>
                  <td>{r.side}</td>
                  <td className="mono">{r.invoice_no || ''}</td>
                  <td className="mono">{r.date_text || ''}</td>
                  <td className="mono">{r.amount_a ?? ''}</td>
                  <td className="mono">{r.amount_b ?? ''}</td>
                  <td className="mono">{r.variance ?? ''}</td>
                  <td className="mono">{r.match_rule || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettlementTab({ parties, settlement, settlementLines, adjustments, onGenerate, onAddAdjustment, t }: any) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [justification, setJustification] = useState('');

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('settlement')}</div>
        <button className="btn primary" onClick={onGenerate} disabled={!onGenerate}>{t('generate_settlement')}</button>

        {settlement && (
          <div className="kv">
            <div>ID: <span className="mono">{settlement.id.slice(0, 12)}</span></div>
            <div>{t('company_a')}: {settlement.net_payable_to_a}</div>
            <div>{t('company_b')}: {settlement.net_payable_to_b}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="cardTitle">Lines</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr><th>Invoice</th><th>Date</th><th>A</th><th>B</th><th>Var</th><th>Class</th></tr>
            </thead>
            <tbody>
              {settlementLines.slice(0, 200).map((l: SettlementLine) => (
                <tr key={l.id}>
                  <td className="mono">{l.invoice_no || ''}</td>
                  <td className="mono">{l.date_text || ''}</td>
                  <td className="mono">{l.amount_a ?? ''}</td>
                  <td className="mono">{l.amount_b ?? ''}</td>
                  <td className="mono">{l.variance ?? ''}</td>
                  <td className="mono">{l.classification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">{t('create')} {t('new_finding')}</div>
        <div className="muted">{t('new_finding')} (Expert Adjustment)</div>
        <div className="field">
          <label className="label">{t('description')}</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label className="label">{t('tolerance_amount')}</label>
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value || '0'))} />
        </div>
        <div className="field">
          <label className="label">{t('notes')}</label>
          <textarea className="textarea" value={justification} onChange={(e) => setJustification(e.target.value)} />
        </div>
        <button className="btn" onClick={() => {
          if (!description.trim()) return;
          onAddAdjustment({ description: description.trim(), amount, justification: justification.trim() || undefined });
          setDescription(''); setAmount(0); setJustification('');
        }} disabled={!settlement}>
          {t('add')}
        </button>

        <div className="divider" />
        <div className="cardTitle">{t('audit')}</div>
        <ul className="list">
          {adjustments.slice(0, 20).map((a: Adjustment) => (
            <li key={a.id} className="listItem">
              <div className="mono">{a.amount}</div>
              <div>{a.description}</div>
              <div className="muted">{a.created_at}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FrameworksTab({ lang, frameworkInfos, caseFrameworks, onSave, onSeedChecklists, t }: any) {
  const map = new Map(caseFrameworks.map((x: CaseFramework) => [x.framework_code, x.enabled]));
  const [local, setLocal] = useState<CaseFramework[]>(caseFrameworks);

  useEffect(() => setLocal(caseFrameworks), [caseFrameworks]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('frameworks')}</div>
        <ul className="list">
          {frameworkInfos.map((f: FrameworkInfo) => {
            const enabled = map.get(f.code) ?? true;
            return (
              <li key={f.code} className="listItem">
                <div className="grow">
                  <div className="strong"><FrameworkName f={f} lang={lang} /></div>
                  <div className="muted">{lang === 'ar' ? f.description_ar : f.description_en}</div>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!(local.find(x => x.framework_code === f.code)?.enabled ?? enabled)}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setLocal(prev => {
                        const next = [...prev];
                        const idx = next.findIndex(x => x.framework_code === f.code);
                        if (idx >= 0) next[idx] = { ...next[idx], enabled: v };
                        else next.push({ framework_code: f.code, enabled: v });
                        return next;
                      });
                    }}
                  />
                  <span>{t('enable')}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="row">
          <button className="btn primary" onClick={() => onSave(local)}>{t('save')}</button>
          <button className="btn" onClick={() => onSeedChecklists()}>{t('seed_checklists')}</button>
        </div>
      </div>
    </div>
  );
}

function ChecklistsTab({ lang, checklists, enabledCodes, onPatch, t }: any) {
  const [filter, setFilter] = useState<string>('ALL');
  const visible = checklists.filter((c: ChecklistItem) => (filter === 'ALL' ? enabledCodes.has(c.framework_code) : c.framework_code === filter));

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('checklists')}</div>
        <div className="row">
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">ALL</option>
            <option value="ACCOUNTING_EXPERT">ACCOUNTING_EXPERT</option>
            <option value="AUDIT_IFRS_ISA">AUDIT_IFRS_ISA</option>
            <option value="FIDIC">FIDIC</option>
          </select>
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Framework</th>
                <th>Standard</th>
                <th>{t('status')}</th>
                <th>{t('notes')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c: ChecklistItem) => (
                <tr key={c.id}>
                  <td className="mono">{c.framework_code}</td>
                  <td className="mono">{c.standard_code}</td>
                  <td>
                    <select
                      className="select"
                      value={c.status}
                      onChange={(e) => onPatch(c.id, { status: e.target.value })}
                    >
                      <option value="pending">pending</option>
                      <option value="pass">pass</option>
                      <option value="fail">fail</option>
                      <option value="na">na</option>
                    </select>
                  </td>
                  <td>
                    <textarea
                      className="textarea"
                      value={c.notes || ''}
                      onChange={(e) => onPatch(c.id, { notes: e.target.value })}
                      placeholder={lang === 'ar' ? c.requirement_ar : c.requirement_en}
                      rows={2}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({ caseId, evidence, files, onAdd, t }: any) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'document' | 'ledger' | 'note' | 'other'>('document');
  const [sourceFileId, setSourceFileId] = useState<string>('');
  const [pageNo, setPageNo] = useState<string>('');
  const [rowIndex, setRowIndex] = useState<string>('');
  const [excerpt, setExcerpt] = useState('');

  useEffect(() => {
    if (!sourceFileId && files.length) setSourceFileId(files[0].id);
  }, [files, sourceFileId]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('new_evidence')}</div>
        <div className="field">
          <label className="label">{t('evidence_title')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="row">
          <div className="field grow">
            <label className="label">{t('type')}</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value="document">document</option>
              <option value="ledger">ledger</option>
              <option value="note">note</option>
              <option value="other">other</option>
            </select>
          </div>
          <div className="field grow">
            <label className="label">{t('file')}</label>
            <select className="select" value={sourceFileId} onChange={(e) => setSourceFileId(e.target.value)}>
              <option value="">(none)</option>
              {files.map((f: FileItem) => (
                <option key={f.id} value={f.id}>{f.filename}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field grow">
            <label className="label">{t('page')}</label>
            <input className="input" value={pageNo} onChange={(e) => setPageNo(e.target.value)} />
          </div>
          <div className="field grow">
            <label className="label">{t('row')}</label>
            <input className="input" value={rowIndex} onChange={(e) => setRowIndex(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label className="label">{t('excerpt')}</label>
          <textarea className="textarea" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={4} />
        </div>
        <button className="btn primary" onClick={() => {
          if (!title.trim()) return;
          onAdd({
            title: title.trim(),
            evidence_type: type,
            source_file_id: sourceFileId || undefined,
            page_no: pageNo ? parseInt(pageNo, 10) : undefined,
            row_index: rowIndex ? parseInt(rowIndex, 10) : undefined,
            excerpt_text: excerpt.trim() || undefined,
          });
          setTitle(''); setExcerpt(''); setPageNo(''); setRowIndex('');
        }}>
          {t('add')}
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">{t('evidence')}</div>
        <ul className="list">
          {evidence.map((e: Evidence) => (
            <li key={e.id} className="listItem">
              <div className="strong">{e.title}</div>
              <div className="muted mono">{e.id}</div>
              <div className="muted">{e.evidence_type} {e.page_no ? `p.${e.page_no}` : ''} {e.row_index ? `row ${e.row_index}` : ''}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FindingsTab({ caseId, lang, frameworkInfos, enabledCodes, evidence, findings, onAdd, t }: any) {
  const [framework, setFramework] = useState<string>('ACCOUNTING_EXPERT');
  const [titleEn, setTitleEn] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [standardRefs, setStandardRefs] = useState('');
  const [evidenceIds, setEvidenceIds] = useState('');

  useEffect(() => {
    const enabled = frameworkInfos.find((x: FrameworkInfo) => enabledCodes.has(x.code))?.code;
    if (enabled) setFramework(enabled);
  }, [frameworkInfos, enabledCodes]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('new_finding')}</div>
        <div className="field">
          <label className="label">Framework</label>
          <select className="select" value={framework} onChange={(e) => setFramework(e.target.value)}>
            {frameworkInfos.filter((x: FrameworkInfo) => enabledCodes.has(x.code)).map((f: FrameworkInfo) => (
              <option key={f.code} value={f.code}>{f.code}</option>
            ))}
          </select>
        </div>

        <div className="row">
          <div className="field grow">
            <label className="label">Title (EN)</label>
            <input className="input" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </div>
          <div className="field grow">
            <label className="label">العنوان (AR)</label>
            <input className="input" value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
          </div>
        </div>

        <div className="row">
          <div className="field grow">
            <label className="label">Description (EN)</label>
            <textarea className="textarea" value={descEn} onChange={(e) => setDescEn(e.target.value)} rows={3} />
          </div>
          <div className="field grow">
            <label className="label">الوصف (AR)</label>
            <textarea className="textarea" value={descAr} onChange={(e) => setDescAr(e.target.value)} rows={3} />
          </div>
        </div>

        <div className="row">
          <div className="field grow">
            <label className="label">{t('severity')}</label>
            <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
          </div>
          <div className="field grow">
            <label className="label">{t('standard_refs')}</label>
            <input className="input" value={standardRefs} onChange={(e) => setStandardRefs(e.target.value)} placeholder="IAS 1, ISA 500, FIDIC 1999 Cl. 20" />
          </div>
        </div>

        <div className="field">
          <label className="label">{t('evidence_ids')}</label>
          <input className="input" value={evidenceIds} onChange={(e) => setEvidenceIds(e.target.value)} placeholder={evidence.slice(0, 3).map((x: Evidence) => x.id).join(', ')} />
        </div>

        <button className="btn primary" onClick={() => {
          if (!framework || !titleEn.trim() || !titleAr.trim()) return;
          onAdd({
            framework_code: framework,
            title_en: titleEn.trim(),
            title_ar: titleAr.trim(),
            description_en: descEn.trim() || undefined,
            description_ar: descAr.trim() || undefined,
            severity,
            standard_refs: standardRefs.split(',').map(s => s.trim()).filter(Boolean),
            evidence_ids: evidenceIds.split(',').map(s => s.trim()).filter(Boolean),
          });
          setTitleEn(''); setTitleAr(''); setDescEn(''); setDescAr(''); setStandardRefs(''); setEvidenceIds('');
        }}>
          {t('add')}
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">{t('findings')}</div>
        <ul className="list">
          {findings.map((f: Finding) => (
            <li key={f.id} className="listItem">
              <div className="strong">[{f.severity}] {lang === 'ar' ? f.title_ar : f.title_en}</div>
              <div className="muted mono">{f.framework_code} — {f.id}</div>
              <div className="muted">{lang === 'ar' ? (f.description_ar || '') : (f.description_en || '')}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReportTab({ caseId, runId, settlementId, t }: any) {
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [lang, setLang] = useState<'en' | 'ar' | 'bi'>('bi');

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('report')}</div>
        <div className="row">
          <div className="field grow">
            <label className="label">Format</label>
            <select className="select" value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="docx">docx</option>
              <option value="pdf">pdf</option>
            </select>
          </div>
          <div className="field grow">
            <label className="label">Language</label>
            <select className="select" value={lang} onChange={(e) => setLang(e.target.value as any)}>
              <option value="en">{t('lang_en')}</option>
              <option value="ar">{t('lang_ar')}</option>
              <option value="bi">{t('lang_bi')}</option>
            </select>
          </div>
        </div>

        <div className="muted">Run ID: <span className="mono">{runId || '(none)'}</span></div>
        <div className="muted">Settlement ID: <span className="mono">{settlementId || '(none)'}</span></div>

        <button
          className="btn primary"
          disabled={!runId || !settlementId}
          onClick={() => api.exportReport(caseId, runId, settlementId, format, lang).catch((err) => alert(err.message))}
        >
          {format === 'docx' ? t('export_docx') : t('export_pdf')}
        </button>

        <div className="muted">
          PDF export is English-only. For Arabic/Bilingual, use DOCX.
        </div>
      </div>
    </div>
  );
}

function AuditTab({ audit, t }: any) {
  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">{t('audit')}</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr><th>When</th><th>Action</th><th>Entity</th><th>Details</th></tr>
            </thead>
            <tbody>
              {audit.slice(0, 200).map((a: any, idx: number) => (
                <tr key={idx}>
                  <td className="mono">{a.created_at}</td>
                  <td className="mono">{a.action}</td>
                  <td className="mono">{a.entity_type}:{String(a.entity_id).slice(0, 12)}</td>
                  <td className="mono">{a.details ? JSON.stringify(a.details) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GeneralTab({ caseData, parties, onUpdate, onRefresh, t }: any) {
  const [form, setForm] = useState(caseData);

  // Updates local form when caseData changes
  useEffect(() => { setForm(caseData); }, [caseData]);

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">Case Details / تفاصيل القضية</div>
        <div className="row">
          <div className="field grow">
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field grow">
            <label className="label">Case No (رقم الدعوى)</label>
            <input className="input" value={form.case_no || ''} onChange={e => setForm({ ...form, case_no: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label className="label">Desc (Mission) / المهمة</label>
          <textarea className="textarea" rows={3} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="field">
          <label className="label">Circuit / الدائرة</label>
          <input className="input" value={form.court_circuit || ''} onChange={e => setForm({ ...form, court_circuit: e.target.value })} />
        </div>
        <button className="btn primary" onClick={async () => {
          await api.updateCase(caseData.id, form.title, form.description, form.court_circuit, form.case_no);
          onUpdate();
        }}>Save Case Info</button>
      </div>

      <div className="card">
        <div className="cardTitle">Parties / الأطراف (and Lawyers)</div>
        <PartiesList caseId={caseData.id} parties={parties} onRefresh={onRefresh} t={t} />
      </div>
    </div>
  )
}

function PartiesList({ caseId, parties, onRefresh, t }: any) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Party['role']>('company_a');
  const [lawyer, setLawyer] = useState('');

  return (
    <div>
      <div className="row">
        <div className="field grow">
          <label className="label">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="field grow">
          <label className="label">Role</label>
          <select className="select" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="company_a">{t('company_a')}</option>
            <option value="company_b">{t('company_b')}</option>
            <option value="other">{t('other')}</option>
          </select>
        </div>
        <div className="field grow">
          <label className="label">Lawyer</label>
          <input className="input" value={lawyer} onChange={e => setLawyer(e.target.value)} />
        </div>
        <button className="btn primary" onClick={async () => {
          await api.addParty(caseId, name, role, lawyer);
          setName(''); setLawyer('');
          onRefresh();
        }}>Add</button>
      </div>

      <ul className="list">
        {parties.map((p: Party) => (
          <li key={p.id} className="listItem">
            <div className="strong">{p.name} ({roleLabel(p.role, t)})</div>
            <div className="muted">{p.lawyer ? `Lawyer: ${p.lawyer}` : 'No lawyer'}</div>
            <button className="btn sm" onClick={async () => {
              const newLawyer = prompt("Update Lawyer Name:", p.lawyer || '');
              if (newLawyer !== null) {
                await api.updateParty(p.id, undefined, undefined, newLawyer);
                onRefresh();
              }
            }}>Edit Lawyer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProceduresTab({ caseId, procedures, onRefresh, t }: any) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [descEn, setDescEn] = useState('');
  const [descAr, setDescAr] = useState('');

  return (
    <div className="grid">
      <div className="card">
        <div className="cardTitle">New Procedure / إجراء جديد</div>
        <div className="row">
          <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="row">
          <div className="field grow">
            <label className="label">En</label>
            <input className="input" value={descEn} onChange={e => setDescEn(e.target.value)} />
          </div>
          <div className="field grow">
            <label className="label">Ar</label>
            <input className="input" value={descAr} onChange={e => setDescAr(e.target.value)} style={{ direction: 'rtl' }} />
          </div>
        </div>
        <button className="btn primary" onClick={async () => {
          await api.createProcedure(caseId, date, descEn, descAr);
          setDescEn(''); setDescAr('');
          onRefresh();
        }}>Add Procedure</button>
      </div>

      <div className="card">
        <div className="cardTitle">History / السجل</div>
        <table className="table">
          <thead><tr><th>Date</th><th>Action (Ar)</th><th>Action (En)</th><th></th></tr></thead>
          <tbody>
            {procedures.map((p: any) => (
              <tr key={p.id}>
                <td>{p.date}</td>
                <td align="right">{p.description_ar}</td>
                <td>{p.description_en}</td>
                <td><button className="btn sm danger" onClick={async () => { await api.deleteProcedure(p.id); onRefresh(); }}>x</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
