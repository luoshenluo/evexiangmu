import { useState, useEffect, type ChangeEvent } from 'react';

export function NumberInput({ value, onChange, step = '0.01', placeholder = '', className = '' }: { value: number; onChange: (num: number) => void; step?: string; placeholder?: string; className?: string; }) {
  const [localValue, setLocalValue] = useState<string>(value === 0 ? '' : String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { if (!isEditing) setLocalValue(value === 0 ? '' : String(value)); }, [value, isEditing]);

  const displayValue = isEditing ? localValue : value === 0 ? '' : String(value);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    setLocalValue(raw);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === '' || trimmed === '.') { setLocalValue(''); onChange(0); return; }
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) { setLocalValue(''); onChange(0); return; }
    setLocalValue(String(num));
    onChange(num);
  };

  return <input type="text" inputMode="decimal" step={step} value={displayValue} onChange={handleChange} onBlur={handleBlur} onFocus={() => setIsEditing(true)} placeholder={placeholder} className={className} />;
}