import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, RefreshCw, Check, Image as ImageIcon, Trash2, HelpCircle } from 'lucide-react';

interface ProductPhotoCaptureProps {
  imageUrl: string;
  onChange: (url: string) => void;
  label?: string;
}

export default function ProductPhotoCapture({
  imageUrl,
  onChange,
  label = "Product Visual Identification"
}: ProductPhotoCaptureProps) {
  const [isCamOpen, setIsCamOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      // Prompt user for camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCamOpen(true);
    } catch (err: any) {
      console.warn('Camera Access Info/Warning (Dismissed, blocked or inactive):', err);
      setErrorMsg('Could not access device camera. Inside sandboxed preview views, standard camera access can be blocked by default. Please verify permissions or use the presets / local upload fallbacks below!');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCamOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        // Match the video capture dimensions
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        
        // Flip image horizontally if front-facing (though environment facing is preferred for product captures)
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Output compressed jpeg as Base64 Data URI
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        onChange(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const processFile = (file: File | undefined) => {
    if (!file) return;
    
    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Invalid file type selected. Please upload an image file (PNG/JPEG/WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result);
        setErrorMsg('');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to process image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  return (
    <div className="space-y-3 font-sans text-left" id="product-photo-capture-wrapper">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider">
          {label}
        </label>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 uppercase transition-all"
            title="Remove current image"
          >
            <Trash2 size={12} />
            Reset Image
          </button>
        )}
      </div>

      {isCamOpen ? (
        /* Active Camera Capture Live Stream */
        <div className="relative border border-indigo-200 bg-slate-900 rounded-xl overflow-hidden shadow-inner flex flex-col items-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-h-56 object-cover bg-black"
          />
          <div className="absolute top-2 right-2 bg-rose-600/90 hover:bg-rose-500 text-white p-1.5 rounded-full cursor-pointer transition-all" onClick={stopCamera} title="Close Camera Feed">
            <X size={14} />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex justify-center gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] py-1.5 px-4 rounded-lg uppercase tracking-wider transition-all flex items-center gap-1 h-8 shadow-md"
            >
              <Check size={12} />
              Take Snapshot
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg uppercase tracking-wider transition-all"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        /* Photo Selector Dashboard */
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Main Visual Display (Thumbnail / Dropzone / Placeholder) */}
          <div 
            className={`col-span-1 sm:col-span-4 h-24 rounded-xl border-2 flex flex-col items-center justify-center overflow-hidden transition-all ${
              imageUrl 
              ? 'border-indigo-400 bg-indigo-50/20' 
              : isDragging 
                ? 'border-indigo-500 bg-indigo-50 border-dashed animate-pulse' 
                : 'border-slate-200 border-dashed hover:border-slate-300 bg-slate-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt="Product Preview" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="text-center p-2">
                <ImageIcon className="text-slate-350 mx-auto mb-1" size={18} />
                <span className="text-[9px] text-slate-400 font-bold block">No Photo</span>
              </div>
            )}
          </div>

          {/* Setup / Capture actions input console */}
          <div className="col-span-1 sm:col-span-8 flex flex-col justify-between gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-extrabold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer shadow-xs"
              >
                <Camera size={13} />
                Camera Capture
              </button>
              
              <label className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-extrabold py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer shadow-3xs text-center">
                <Upload size={13} className="text-slate-500" />
                Upload File
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="relative">
                <input 
                  type="text"
                  value={imageUrl.startsWith('data:') ? 'Captured live camera snapshot (Base64)' : imageUrl}
                  disabled={imageUrl.startsWith('data:')}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder="Or paste external image URL..."
                  className={`w-full border border-slate-200 px-2.5 py-1.5 rounded-lg text-[10px] focus:ring-1 focus:ring-indigo-500 ${
                    imageUrl.startsWith('data:') ? 'bg-indigo-50/40 text-indigo-700 border-indigo-150 font-bold' : 'bg-white'
                  }`}
                  title={imageUrl.startsWith('data:') ? 'Base64 image is already stored. Reset to enter Web URL.' : ''}
                />
                {imageUrl && !imageUrl.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    title="Clear link"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
              <span className="text-[9px] text-slate-500 font-medium">
                Camera captures photos immediately. Drag & drop files, or paste custom picture links.
              </span>
            </div>

            {/* Premium Stock Tech Presets Slider */}
            <div className="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
              <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest block">No camera? Select tech photo preset:</span>
              <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                {[
                  { name: 'Laptop', url: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=350&q=80' },
                  { name: 'Desktop PC', url: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=350&q=80' },
                  { name: 'Monitor', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=350&q=80' },
                  { name: 'Keyboard', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=350&q=80' },
                  { name: 'Accessories', url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=350&q=80' }
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => onChange(preset.url)}
                    className="flex-shrink-0 flex items-center gap-1 bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-2 py-1 rounded-lg text-[9px] font-bold transition-all cursor-pointer"
                  >
                    <img src={preset.url} alt="" className="w-5 h-5 rounded object-cover" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="text-[10px] font-bold text-rose-600 bg-rose-50/50 p-2 border border-rose-100/60 rounded-lg">
          {errorMsg}
        </div>
      )}
      
      {/* Offscreen drawing Canvas for snapshot extraction */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
