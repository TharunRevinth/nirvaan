import React, { useState, useEffect } from 'react';

export default function AccessibilityBar() {
  const [lang, setLang] = useState('en');
  const [highContrast, setHighContrast] = useState(false);
  const [activeSize, setActiveSize] = useState('md');

  const toggleFontSize = (size) => {
    setActiveSize(size);
    const root = document.documentElement;
    if (size === 'sm') root.style.fontSize = '14px';
    if (size === 'md') root.style.fontSize = '16px';
    if (size === 'lg') root.style.fontSize = '18px';
  };

  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add('contrast-high');
    } else {
      document.documentElement.classList.remove('contrast-high');
    }
  }, [highContrast]);

  return (
    <div className="bg-surface text-secondary px-6 py-1 flex justify-between items-center text-[11px] border-b border-line">
      <div>
        <a 
          href="#main-content" 
          className="text-muted hover:text-primary text-[11px] hover:underline focus-visible:ring-1 focus-visible:ring-oxide focus-visible:outline-none px-1 rounded transition-colors"
        >
          Skip to main content
        </a>
      </div>

      <div className="flex items-center gap-3">
        {/* Font-size +/- controls */}
        <div className="flex items-center gap-1 border-r border-line pr-3">
          <span className="text-[10px] text-muted mr-1 select-none">Text size:</span>
          <button 
            type="button"
            onClick={() => toggleFontSize('sm')} 
            aria-label="Decrease font size to small"
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
              activeSize === 'sm' ? 'bg-primary text-white border-primary' : 'border-line hover:bg-canvas text-secondary'
            }`}
          >
            A-
          </button>
          <button 
            type="button"
            onClick={() => toggleFontSize('md')} 
            aria-label="Reset font size to default"
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
              activeSize === 'md' ? 'bg-primary text-white border-primary' : 'border-line hover:bg-canvas text-secondary'
            }`}
          >
            A
          </button>
          <button 
            type="button"
            onClick={() => toggleFontSize('lg')} 
            aria-label="Increase font size to large"
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
              activeSize === 'lg' ? 'bg-primary text-white border-primary' : 'border-line hover:bg-canvas text-secondary'
            }`}
          >
            A+
          </button>
        </div>

        {/* High contrast switch */}
        <div className="flex items-center gap-1.5 border-r border-line pr-3">
          <button
            type="button"
            onClick={() => setHighContrast(!highContrast)}
            aria-pressed={highContrast}
            className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
              highContrast 
                ? 'bg-primary text-white border-primary font-medium' 
                : 'border-line text-secondary hover:bg-canvas'
            }`}
          >
            High Contrast
          </button>
        </div>

        {/* Bilingual Hindi/English Switcher */}
        <div className="flex items-center">
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            aria-label="Select language"
            className="bg-transparent border border-line rounded px-1.5 py-0.5 text-[10px] text-secondary cursor-pointer focus-visible:outline-none focus-visible:border-oxide"
          >
            <option value="en">English (EN)</option>
            <option value="hi">हिन्दी (HI)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
