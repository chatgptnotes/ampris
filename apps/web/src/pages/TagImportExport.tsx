import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/services/api';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, FileDown } from 'lucide-react';

interface PreviewRow {
  _row: number;
  _errors: string[];
  name: string;
  type: string;
  dataType: string;
  [key: string]: any;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
  total: number;
}

export default function TagImportExport() {
  const { projectId } = useParams<{ projectId: string }>();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', f);
      const { data } = await api.post('/import/tags/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data.preview);
      setTotalRows(data.totalRows);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse file');
      setPreview(null);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const doImport = async () => {
    if (!file || !projectId) return;
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);
      const { data } = await api.post('/import/tags', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const exportCSV = async () => {
    try {
      const { data } = await api.get('/export/tags', {
        params: { projectId, format: 'csv' },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = 'tags-export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Export failed');
    }
  };

  const downloadTemplate = async () => {
    try {
      const { data } = await api.post('/import/tags/template', {}, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = 'gridvision-tag-template.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download template');
    }
  };

  const reset = () => { setFile(null); setPreview(null); setResult(null); setError(null); setTotalRows(0); };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Tag Import / Export</h1>
            <p className="text-sm text-gray-500 mt-0.5">Import tags from CSV/Excel or export existing tags</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              <FileDown className="w-4 h-4" /> Template
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Drop Zone */}
        {!preview && !result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">Drop CSV or Excel file here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="hidden" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div><p className="text-sm text-red-700 font-medium">{error}</p></div>
            <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {/* Preview */}
        {preview && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-800">{file?.name}</p>
                  <p className="text-sm text-gray-500">{totalRows} rows found — showing first {preview.length}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">Cancel</button>
                <button onClick={doImport} disabled={importing} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {importing ? 'Importing...' : `Import ${totalRows} Tags`}
                </button>
              </div>
            </div>

            {importing && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Data Type</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Unit</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Group</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${row._errors.length > 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-3 py-2 text-gray-400">{row._row}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{row.name || <span className="text-red-500 italic">missing</span>}</td>
                      <td className="px-3 py-2 text-gray-600">{row.type}</td>
                      <td className="px-3 py-2 text-gray-600">{row.dataType}</td>
                      <td className="px-3 py-2 text-gray-500">{row.unit || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{row.group || '—'}</td>
                      <td className="px-3 py-2">
                        {row._errors.length > 0 ? (
                          <span className="text-red-600 text-xs">{row._errors[0]}</span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <h2 className="text-lg font-bold text-green-800">Import Complete</h2>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-800">{result.total}</p>
                  <p className="text-xs text-gray-500">Total Rows</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-gray-500">Skipped (duplicates)</p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-600">{result.errors}</p>
                  <p className="text-xs text-gray-500">Errors</p>
                </div>
              </div>
              {result.errorDetails.length > 0 && (
                <div className="mt-4 text-sm text-red-700 space-y-1">
                  {result.errorDetails.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
            <button onClick={reset} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Import More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
