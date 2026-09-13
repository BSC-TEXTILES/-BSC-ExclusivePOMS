import React, { useState, useEffect } from 'react';

export default function PhoneInput({ value, onChange, placeholder = '9876543210', required, className, style, autoFocus }) {
  const [digits, setDigits] = useState('');

  useEffect(() => {
    if (value && typeof value === 'string') {
      let val = value.trim();
      if (val.startsWith('+91')) {
        val = val.substring(3).trim();
      } else if (val.startsWith('91') && val.length > 10) {
        val = val.substring(2).trim();
      }
      setDigits(val.replace(/\D/g, '').substring(0, 10));
    } else {
      setDigits('');
    }
  }, [value]);

  const handleChange = (e) => {
    let input = e.target.value;
    let raw = input.replace(/\D/g, '');
    
    // If they pasted a number with country code, strip it
    if (raw.startsWith('91') && raw.length > 10) {
      raw = raw.substring(2);
    }
    
    const limited = raw.substring(0, 10);
    setDigits(limited);
    
    if (limited) {
      onChange({ target: { value: '+91 ' + limited } });
    } else {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden', ...style }} className={className}>
      <div style={{ padding: '9px 12px', background: '#f9fafb', color: '#4b5563', borderRight: '1px solid #d1d5db', fontSize: 14, fontWeight: 500, userSelect: 'none' }}>
        +91
      </div>
      <input
        type="tel"
        value={digits}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: 14, width: '100%', background: 'transparent' }}
      />
    </div>
  );
}
