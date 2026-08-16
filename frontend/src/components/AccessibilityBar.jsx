import React, { useState } from 'react';

export default function AccessibilityBar() {
  const [lang, setLang] = useState('en');
  const [highContrast, setHighContrast] = useState(false);

  const toggleFontSize = (size) => {
    const root = document.documentElement;
    if (size === 'sm') root.style.fontSize = '14px';
    if (size === 'md') root.style.fontSize = '16px';
    if (size === 'lg') root.style.fontSize = '18px';
  };

  return (
    <div className="bg-graphite text-offwhite px-4 py-1 flex justify-between items-center text-xs border-b border-graphite/30">
      <div>
        {/* Working Skip to Main Content Link */}
        <a 
          href="#main-content" 
          className="text-offwhite/80 hover:text-white underline text-[11px] focus:outline-none focus:ring-2 focus:ring-copper p-0.5"
        >
          Skip to Main Content
        </a>
      </div>

      <div className="flex items-center gap-4">
        {/* Font-size +/- controls */}
        <div className="flex items-center gap-1 border-r border-offwhite/20 pr-3">
          <span className="text-[10px] text-offwhite/60 mr-1">Text Size:</span>
          <button 
            onClick={() => toggleFontSize('sm')} 
            aria-label="Decrease font size"
            className="px-1.5 py-0.5 bg-offwhite/10 hover:bg-offwhite/20 text-[10px] font-bold"
          >
            A-
          </button>
          <button 
            onClick={() => toggleFontSize('md')} 
            aria-label="Reset font size to normal"
            className="px-1.5 py-0.5 bg-offwhite/10 hover:bg-offwhite/20 text-[10px] font-bold"
          >
            A
          </button>
          <button 
            onClick={() => toggleFontSize('lg')} 
            aria-label="Increase font size"
            className="px-1.5 py-0.5 bg-offwhite/10 hover:bg-offwhite/20 text-[10px] font-bold"
          >
            A+
          </button>
        </div>

        {/* High Contrast Toggle */}
        <div className="flex items-center gap-1 border-r border-offwhite/20 pr-3">
          <button 
            onClick={() => setHighContrast(!highContrast)} 
            aria-label="Toggle high contrast mode"
            className="text-[11px] text-offwhite/80 hover:text-white flex items-center gap-1"
          >
            <span className="w-3 h-3 border border-offwhite bg-graphite inline-block"></span>
            Contrast
          </button>
        </div>

        {/* Bilingual Toggle */}
        <div className="flex items-center gap-1">
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            aria-label="Select Portal Language"
            className="bg-transparent text-offwhite border border-offwhite/20 text-xs py-0.5 px-1.5 outline-none cursor-pointer"
          >
            <option value="en" className="text-graphite">English</option>
            <option value="hi" className="text-graphite">हिन्दी</option>
          </select>
        </div>
      </div>
    </div>
  );
}
