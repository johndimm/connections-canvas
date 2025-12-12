import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core';
import { WordItem } from './types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from './services/geminiService';
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Move } from 'lucide-react';

// Fisher-Yates shuffle to randomize word order
const shuffle = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

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
  const activeTouches = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, 
      },
    })
  );

  const hasInitialized = useRef(false);

  const calculateResponsiveLayout = useCallback((wordList: string[]) => {
    const cols = 4;
    const gap = 16;
    const tileW = 150;
    const tileH = 80;
    
    // World dimensions
    const totalW = (cols * tileW) + ((cols - 1) * gap);

    const screenW = window.innerWidth;
    const hPadding = 40;
    
    let scale = 1;
    if (screenW < totalW + hPadding) {
        scale = (screenW - hPadding) / totalW;
    }
    scale = Math.max(0.4, Math.min(1.2, scale));

    const gridScreenW = totalW * scale;
    const startViewportX = (screenW - gridScreenW) / 2;
    // Push it down a bit more to account for the header in world space
    const startViewportY = screenW < 640 ? 160 : 200;

    setLayoutConfig({ tileW, tileH });

    const newWords = wordList.map((text, i) => ({
      id: `word-${i}-${Date.now()}`,
      text,
      x: (i % cols) * (tileW + gap),
      y: Math.floor(i / cols) * (tileH + gap),
    }));

    return { words: newWords, viewport: { x: startViewportX, y: startViewportY, scale } };
  }, []);

  const initializeBoard = useCallback((newWordList: string[]) => {
    // Shuffle the words so they don't appear in solved groups (if API returns them that way)
    const shuffledWords = shuffle(newWordList);
    const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(shuffledWords);
    setWords(newWords);
    setViewport(newViewport);
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

  const handlePointerDown = (e: React.PointerEvent) => {
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
    if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId)) {
        e.target.releasePointerCapture(e.pointerId);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
      activeTouches.current = e.touches.length;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
     activeTouches.current = e.touches.length;
     if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        if (lastPinchDist.current !== null) {
            const delta = dist - lastPinchDist.current;
            const zoomFactor = delta * 0.005;
            const newScale = Math.max(0.1, Math.min(3, viewport.scale + zoomFactor));
            setViewport(prev => ({ ...prev, scale: newScale }));
        }
        lastPinchDist.current = dist;
     }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      activeTouches.current = e.touches.length;
      if (e.touches.length < 2) {
          lastPinchDist.current = null;
      }
  };
  
  const zoomIn = () => setViewport(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }));
  const zoomOut = () => setViewport(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (Math.abs(delta.x) === 0 && Math.abs(delta.y) === 0) return;
    
    const adjustedX = delta.x / viewport.scale;
    const adjustedY = delta.y / viewport.scale;

    setWords((prev) =>
      prev.map((w) => w.id === active.id ? { ...w, x: w.x + adjustedX, y: w.y + adjustedY } : w)
    );
  };

  const handleDragCancel = () => {
      // Logic handled by dnd-kit internal state reset
  };
  
  const cancelDrop = () => {
      return activeTouches.current > 1;
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
      const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(currentWordTexts);
      setWords(newWords);
      setViewport(newViewport);
  };

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric'
  });

  // Calculate width for centering the title in World Space
  const totalGridWidth = (4 * layoutConfig.tileW) + (3 * 16);

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
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
                 e.preventDefault();
                 const zoomFactor = -e.deltaY * 0.001;
                 setViewport(prev => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale + zoomFactor)) }));
            }
        }}
    >
       <div 
         className="absolute inset-0 pointer-events-none opacity-30 origin-top-left" 
         style={{
            backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
         }}
       />

      {/* World Viewport */}
      <div 
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ 
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
        }}
      >
          {/* World Header - Moves with the world */}
          <div 
             className="absolute flex flex-col items-center justify-end pb-4 pointer-events-none"
             style={{
                 left: 0,
                 top: -150,
                 width: totalGridWidth,
                 height: 150,
             }}
          >
             <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight text-center whitespace-nowrap drop-shadow-sm">
                Connections Scratchpad — {dateStr}
             </h1>
             <p className="text-stone-500 text-base font-medium mt-1 text-center">
               Pan/Zoom to explore • Drag to group
             </p>
          </div>

          <DndContext 
            sensors={sensors} 
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            cancelDrop={cancelDrop}
          >
            {words.map((word) => (
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
      
      {/* Floating Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 pointer-events-auto">
          <button 
             onClick={handleResetLayout} 
             className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200 mb-2"
             title="Reset Layout"
          >
             <RefreshCw size={24} />
          </button>

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