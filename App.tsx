import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, DragStartEvent } from '@dnd-kit/core';
import { WordItem } from './types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from './services/geminiService';
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Move } from 'lucide-react';



const App: React.FC = () => {
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [puzzleDate, setPuzzleDate] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  
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

  const calculateResponsiveLayout = useCallback((wordList: { text: string; imageUrl?: string }[]) => {
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

    const newWords = wordList.map((card, i) => ({
      id: `word-${i}-${Date.now()}`,
      text: card.text,
      imageUrl: card.imageUrl,
      x: (i % cols) * (tileW + gap),
      y: Math.floor(i / cols) * (tileH + gap),
    }));

    return { words: newWords, viewport: { x: startViewportX, y: startViewportY, scale } };
  }, []);

  const initializeBoard = useCallback((newWordList: { text: string; imageUrl?: string }[]) => {
    const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(newWordList);
    setWords(newWords);
    setViewport(newViewport);
    setIsInitializing(false);
    hasInitialized.current = true;
  }, [calculateResponsiveLayout]);

  const loadPuzzle = useCallback(async (dayOffset: number, isInitial = false) => {
    setSwitchError(null);
    try {
      const { cards, puzzleDate: date } = await fetchDailyPuzzle(dayOffset);
      setPuzzleDate(date);
      const cardList = cards.slice(0, 16);
      try {
        const savedRaw = localStorage.getItem(`connections-canvas-${date}`);
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          const savedTexts = new Set<string>(saved.words.map((w: WordItem) => w.text));
          if (saved.words.length === cardList.length && cardList.every((c: { text: string }) => savedTexts.has(c.text))) {
            setWords(saved.words);
            setViewport(saved.viewport);
            setIsInitializing(false);
            hasInitialized.current = true;
            return;
          }
        }
      } catch {}
      initializeBoard(cardList);
    } catch (err) {
      console.error("Load puzzle error:", err);
      if (isInitial) {
        setErrorMsg("Could not load today's puzzle. Please try again later.");
        setIsInitializing(false);
      } else {
        setSwitchError("Not available yet — check back after 9 PM PT.");
      }
    }
  }, [initializeBoard]);

  useEffect(() => {
    if (hasInitialized.current) return;
    loadPuzzle(0, true);
  }, [loadPuzzle]);

  useEffect(() => {
    if (words.length === 0 || !puzzleDate) return;
    localStorage.setItem(`connections-canvas-${puzzleDate}`, JSON.stringify({ words, viewport }));
  }, [words, viewport, puzzleDate]);

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
      const currentCards = words.map(w => ({ text: w.text, imageUrl: w.imageUrl }));
      const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(currentCards);
      setWords(newWords);
      setViewport(newViewport);
  };

  const todayLocalStr = (() => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  })();
  const isTomorrow = puzzleDate != null && puzzleDate > todayLocalStr;
  // Tomorrow's puzzle releases at midnight ET — show the link once ET date has advanced past local date
  const etDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const showTomorrowLink = isTomorrow || etDateStr > todayLocalStr;

  const dateStr = puzzleDate
    ? new Date(puzzleDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

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

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-4 gap-4">
        <AlertCircle className="text-red-500" size={40} />
        <p className="text-stone-700 font-sans font-semibold">{errorMsg}</p>
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
               Drag tiles to try out various groupings before{' '}
               <a
                 href="https://www.nytimes.com/games/connections"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="underline hover:text-stone-800 pointer-events-auto transition-colors"
               >
                 playing the actual NYT game
               </a>
               {showTomorrowLink && (
                 <>
                   {' · '}
                   <button
                     className="underline hover:text-stone-800 pointer-events-auto transition-colors bg-transparent border-0 p-0 font-medium text-base cursor-pointer"
                     onClick={() => loadPuzzle(isTomorrow ? 0 : 1)}
                   >
                     {isTomorrow ? "← today's puzzle" : "tomorrow's puzzle →"}
                   </button>
                 </>
               )}
               {switchError && (
                 <span className="block text-amber-600 text-sm mt-1">{switchError}</span>
               )}
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


    </div>
  );
};

export default App;