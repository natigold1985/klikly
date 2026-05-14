import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

function normalizePhone(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
}

function parseCsv(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split(','))
    .map((values) => {
      const phone = normalizePhone(values[0]);
      const fullName = String(values[2] || '').trim().replace(/^"|"$/g, '');
      const firstName = String(values[1] || '').trim().replace(/^"|"$/g, '');
      const name = fullName || firstName;

      if (!phone || !name) return null;

      return {
        phone,
        name,
        status: 'new',
        source: 'WhatsApp JONI',
      };
    })
    .filter(Boolean);
}

export default function CsvImportButton({ onImport }) {
  const inputRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const leads = parseCsv(String(reader.result || ''));
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