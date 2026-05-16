import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScanSuccess, onClose }: QrScannerProps) {
  const qrCodeRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5Qrcode = new Html5Qrcode("reader");
    qrCodeRef.current = html5Qrcode;

    html5Qrcode.start(
      { facingMode: "environment" },
      { fps: 25, qrbox: { width: 220, height: 220 } },
      (text) => {
        html5Qrcode.stop().then(() => onScanSuccess(text));
      },
      () => {}
    ).catch(err => console.error(err));

    return () => {
      if (qrCodeRef.current?.isScanning) qrCodeRef.current.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white/90 backdrop-blur-xl z-50 flex flex-col p-6 justify-between animate-sf">
      {/* Топовый навигационный бар в стиле iOS */}
      <div className="flex justify-between items-center mt-4">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Сканирование QR</h3>
          <p className="text-[#86868b] text-xs font-normal mt-0.5">Наведите камеру на код в салоне автобуса</p>
        </div>
        <button 
          onClick={onClose} 
          className="p-2.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] rounded-full transition-colors active:scale-95"
        >
          <X className="w-5 h-5 text-[#1d1d1f]" />
        </button>
      </div>

      {/* Рамка сканера а-ля Apple Code Reader */}
      <div className="relative w-full aspect-square max-w-xs mx-auto rounded-[2.5rem] overflow-hidden bg-black shadow-[0_24px_50px_rgba(0,0,0,0.08)] border-4 border-white">
        <div id="reader" className="w-full h-full absolute inset-0" />
        <div className="absolute inset-0 border-[30px] border-white/10 pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-white/40 rounded-2xl"></div>
      </div>

      <div className="text-center text-[10px] font-medium tracking-widest text-[#86868b] uppercase mb-4">
        Автоматический валидатор транспорта
      </div>
    </div>
  );
}