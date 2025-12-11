import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { WordItem } from './types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from './services/geminiService';
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Move } from 'lucide-react';

const App: React.FC = () => {
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Viewport State for Infinite Canvas
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  
  // Layout dimensions
  const [layoutConfig, setLayoutConfig] = useState({ tileW: 150, tileH: 80 });

  // Refs for gesture handling
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Small tolerance to differentiate click from drag
      },
    })
  );

  const hasInitialized = useRef(false);

  const calculateResponsiveLayout = useCallback((wordList: string[]) => {
    // We can use a fixed comfortable layout now that we have zoom/pan
    // But keeping it somewhat responsive initially is good
    const width = window.innerWidth;
    const isMobile = width < 640;
    
    const cols = 4; // Always 4 cols is nicer for Connections
    const gap = 16;
    const tileW = 150;
    const tileH = 80;
    
    // Initial centering logic based on screen
    const totalW = (cols * tileW) + ((cols - 1) * gap);
    // Center in the "World" initially. Let's put 0,0 at center of world content approx
    // But for simplicity, let's start at a nice padding.
    const startX = (width - totalW) / 2; 
    const startY = isMobile ? 180 : 200;

    // Adjust initial scale for mobile to fit everything
    if (isMobile) {
        // Fit 4 cols (approx 660px width) into mobile screen (approx 360-400px)
        const requiredScale = (width - 40) / totalW;
        setViewport(prev => ({ ...prev, scale: Math.max(0.4, Math.min(1, requiredScale)), x: 0, y: 0 }));
    }

    setLayoutConfig({ tileW, tileH });

    return wordList.map((text, i) => ({
      id: `word-${i}-${Date.now()}`,
      text,
      x: startX + (i % cols) * (tileW + gap),
      y: startY + Math.floor(i / cols) * (tileH + gap),
    }));
  }, []);

  const initializeBoard = useCallback((newWordList: string[]) => {
    const layout = calculateResponsiveLayout(newWordList);
    setWords(layout);
    setIsInitializing(false);
    hasInitialized.current = true;
  }, [calculateResponsiveLayout]);

  useEffect(() => {
    const initApp = async () => {
      if (hasInitialized.current) return;
      try {
        const { words } = await fetchDailyPuzzle();
        if (words && words.length > 0) {
           const safeWords = words.slice(0, 16);
           initializeBoard(safeWords);
        } else {
           setErrorMsg("Could not load puzzle data.");
           setIsInitializing(false);
        }
      } catch (err) {
        console.error("Init error:", err);
        setErrorMsg("Failed to connect to puzzle service.");
        setIsInitializing(false);
      }
    };
    initApp();
  }, [initializeBoard]);

  // --- Canvas Interaction Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    // If we clicked on a draggable item, DndKit handles it (stopped propagation usually, or we check target)
    // Check if target is background
    if ((e.target as HTMLElement).closest('[data-draggable="true"]')) {
       return;
    }
    
    isPanning.current = true;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    
    setViewport(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
    }));
    
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanning.current = false;
    lastPinchDist.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Simple Pinch Zoom for Touch
  const handleTouchMove = (e: React.TouchEvent) => {
     if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        if (lastPinchDist.current !== null) {
            const delta = dist - lastPinchDist.current;
            const zoomFactor = delta * 0.005; // sensitivity
            const newScale = Math.max(0.1, Math.min(3, viewport.scale + zoomFactor));
            setViewport(prev => ({ ...prev, scale: newScale }));
        }
        
        lastPinchDist.current = dist;
     }
  };

  const handleTouchEnd = () => {
      lastPinchDist.current = null;
  };
  
  const zoomIn = () => setViewport(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }));
  const zoomOut = () => setViewport(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }));

  // DndKit Handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (Math.abs(delta.x) === 0 && Math.abs(delta.y) === 0) return;
    
    // Adjust delta by scale to map screen movement to world movement
    const adjustedX = delta.x / viewport.scale;
    const adjustedY = delta.y / viewport.scale;

    setWords((prev) =>
      prev.map((w) => w.id === active.id ? { ...w, x: w.x + adjustedX, y: w.y + adjustedY } : w)
    );
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const handleResetLayout = () => {
      const currentWordTexts = words.map(w => w.text);
      const newLayout = calculateResponsiveLayout(currentWordTexts);
      setWords(newLayout);
      // Also reset viewport nicely
      const width = window.innerWidth;
      const isMobile = width < 640;
      if (!isMobile) {
          setViewport(prev => ({ ...prev, x: 0, y: 0, scale: 1 }));
      }
  };

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  });

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-stone-800 mb-6" size={40} />
        <p className="text-stone-600 font-sans">Loading puzzle...</p>
      </div>
    );
  }

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 bg-[#f8f7f4] overflow-hidden select-none font-sans"
        style={{ touchAction: 'none' }} // Critical for custom gesture handling
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        // Map wheel to zoom for desktop convenience
        onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
                 e.preventDefault();
                 const zoomFactor = -e.deltaY * 0.001;
                 setViewport(prev => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale + zoomFactor)) }));
            }
        }}
    >
       {/* Background Grid Pattern - Moves with Pan/Zoom for immersion */}
       <div 
         className="absolute inset-0 pointer-events-none opacity-30 origin-top-left" 
         style={{
            backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
         }}
       />

      {/* Header - Fixed UI */}
      <div className="absolute top-0 w-full pt-4 pb-4 md:pt-8 md:pb-6 border-b border-stone-300 bg-[#f8f7f4]/95 backdrop-blur z-20 flex flex-col items-center justify-center shadow-sm px-4 pointer-events-auto">
         <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-3xl font-extrabold text-stone-900 tracking-tight text-center">
                Connections — {dateStr}
            </h1>
         </div>
         <p className="text-stone-600 text-[10px] md:text-sm font-medium text-center max-w-md leading-relaxed mt-1">
           Pan/Zoom to explore • Drag to group
         </p>
         
         <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
             <button onClick={handleResetLayout} className="p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-600" title="Reset Layout">
                <RefreshCw size={16} />
             </button>
         </div>
      </div>

      {/* Canvas Viewport */}
      <div 
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ 
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
        }}
      >
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            {words.map((word) => (
              // Add a data attribute so we can detect it in pointer events
              <div key={word.id} data-draggable="true" className="absolute" style={{ left: 0, top: 0 }}> 
                  <DraggableWord
                    word={word}
                    isSelected={selectedIds.has(word.id)}
                    onToggleSelect={handleToggleSelect}
                    width={layoutConfig.tileW}
                    height={layoutConfig.tileH}
                    scale={viewport.scale}
                  />
              </div>
            ))}
          </DndContext>
      </div>
      
      {/* Zoom Controls (Fixed UI) */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 pointer-events-auto">
          <button onClick={zoomIn} className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200">
              <ZoomIn size={24} />
          </button>
          <button onClick={zoomOut} className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200">
              <ZoomOut size={24} />
          </button>
           <div className="p-3 bg-white/80 backdrop-blur shadow-sm rounded-full text-stone-400 border border-stone-200 flex justify-center">
              <Move size={24} />
          </div>
      </div>

      {errorMsg && (
          <div className="absolute top-40 left-1/2 -translate-x-1/2 z-50 text-red-700 bg-red-50 px-6 py-4 rounded-xl flex items-center gap-3 border border-red-200 shadow-lg max-w-md w-full pointer-events-auto">
              <AlertCircle size={24} className="shrink-0" />
              <span className="text-sm font-semibold">{errorMsg}</span>
          </div>
      )}

    </div>
  );
};

export default App;