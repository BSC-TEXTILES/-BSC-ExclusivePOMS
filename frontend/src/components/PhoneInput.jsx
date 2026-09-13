import React, { useState, useEffect } from 'react';

export default function PhoneInput({ value, onChange, placeholder = '+91 9876543210', required, className, style, autoFocus }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (value && typeof value === 'string') {
      let digits = value.replace(/\D/g, '');
      if (digits.startsWith('91') && digits.length > 10) {
        digits = digits.substring(2);
      }
      if (digits) {
        setDisplay('+91 ' + digits.substring(0, 10));
      } else {
        setDisplay('');
      }
    } else {
      setDisplay('');
    }
  }, [value]);

  const handleChange = (e) => {
    let input = e.target.value;
    
    // Handle clearing the input
    if (input === '' || input === '+91 ' || input === '+91') {
      setDisplay('');
      onChange({ target: { value: '' } });
      return;
    }

    let digits = input.replace(/\D/g, '');
    
    // If they pasted a number with country code, strip it
    if (digits.startsWith('91') && digits.length > 10) {
      digits = digits.substring(2);
    }
    
    digits = digits.substring(0, 10);
    const formatted = '+91 ' + digits;
    
    setDisplay(formatted);
    // Send the formatted value (+91 9876543210) back up to the form
    onChange({ target: { value: formatted } });
  };

  return (
    <input
      type="tel"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      className={className}
      style={style}
      autoFocus={autoFocus}
      maxLength={14} // "+91 " (4) + 10 digits
    />
  );
}
