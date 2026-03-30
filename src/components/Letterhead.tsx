import React from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function Letterhead({ children, fullPage = false }: { children: React.ReactNode; fullPage?: boolean }) {
  const { settings } = useSettingsStore();

  return (
    <div 
      className="relative bg-white overflow-hidden mx-auto print:shadow-none" 
      style={{ 
        width: '210mm', 
        height: '297mm', 
        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact'
      }}
    >
      {/* Background SVG */}
      <svg 
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 210 297" 
        className="absolute inset-0 w-full h-full pointer-events-none z-0" 
        preserveAspectRatio="none"
      >
        {/* Top Right Blue */}
        <polygon points="130,0 210,0 210,90 200,80 200,10 140,10" fill="#005b8c" />
        
        {/* Left Edge */}
        <polygon points="0,125 10,135 10,143 0,133" fill="#95c11f" />
        <polygon points="0,137 10,147 10,155 0,145" fill="#95c11f" />
        <polygon points="0,159 10,169 10,297 0,297" fill="#005b8c" />
        
        {/* Bottom Edge */}
        <polygon points="0,287 157,287 167,297 0,297" fill="#005b8c" />
        <polygon points="160,287 168,287 178,297 170,297" fill="#95c11f" />
        <polygon points="171,287 210,287 210,297 181,297" fill="#005b8c" />
      </svg>

      {/* Header Logo */}
      {settings?.logoUrl && (
        <div 
          className="absolute z-20" 
          style={{ 
            top: `${(settings.logoTop ?? 0) + 12}mm`, 
            left: `${settings.logoLeft ?? 5}mm` 
          }}
        >
          <img 
            src={settings.logoUrl} 
            alt="Company Logo" 
            className="h-20 w-auto object-contain max-w-[80mm]" 
            referrerPolicy="no-referrer" 
          />
        </div>
      )}

      {/* Content Container */}
      <div 
        className="relative z-10 flex flex-col" 
        style={{ 
          padding: fullPage ? '0' : '40mm 25mm 35mm 25mm', 
          height: '297mm' 
        }}
      >
        {children}
      </div>

      {/* Footer Text */}
      <div className="absolute bottom-[12mm] left-0 w-full text-center z-20 text-[11px] leading-tight text-black px-10" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <p>
          {settings?.phone && <><span className="font-bold">Tel:</span> {settings.phone} | </>}
          {settings?.email && <><span className="font-bold">E-Mail:</span> <span className="text-blue-700 underline">{settings.email}</span></>}
        </p>
        {settings?.address && <p><span className="font-bold">Address:</span> {settings.address}</p>}
        {settings?.name && <p className="font-bold uppercase tracking-widest mt-1 text-[10px] opacity-50">{settings.name}</p>}
      </div>
    </div>
  );
}
