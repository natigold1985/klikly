import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((header) => header.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
    return headers.reduce((row, header, index) => ({ ...row, [header]: values[index] || '' }), {});
  });
}

function pick(row, keys) {
  const key = keys.find((item) => row[item]);
  return key ? row[key] : '';
}

export default function CsvImportButton({ onImport }) {
  const inputRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));
      const leads = rows
        .map((row) => ({
          phone_number: pick(row, ['מספר נייד', 'טלפון', 'phone', 'Phone Number']),
          first_name: pick(row, ['שם', 'first_name', 'First Name']),
          full_name_notes: pick(row, ['שם מלא', 'full_name', 'Full Name and Notes']),
          source: pick(row, ['מקור', 'source', 'Source']) || 'KLIKLY',
          status: 'New Lead',
          created_at: new Date().toISOString(),
        }))
        .filter((lead) => lead.phone_number);
      onImport(leads);
      event.target.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
      <Button variant="outline" onClick={() => inputRef.current?.click()} className="border-slate-200 text-slate-900 hover:bg-slate-100">
        <Upload className="w-4 h-4" />
        ייבוא CSV
      </Button>
    </>
  );
}