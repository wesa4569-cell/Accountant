# Accounting Consultancy Suite (MVP)

This repository is a working end-to-end MVP (frontend + backend) for:
- Case management
- Document upload + text extraction (PDF text extraction / image OCR via Tesseract when available)
- Excel ledger import (XLSX) with auto-mapped columns
- Reconciliation (invoice/amount/date tolerance)
- Settlement statement (net position)
- Report export (DOCX + PDF)
- Audit log

## Run (local)

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

> Frontend proxies `/api` to `http://localhost:8000`.

## Notes
- Database defaults to SQLite `backend/app.db`. You can set `DATABASE_URL` to PostgreSQL.
- Storage defaults to `backend/storage`.
