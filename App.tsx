import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { WordItem } from './types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from './services/geminiService';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Store layout dimensions to pass to children
  const [layoutConfig, setLayoutConfig] = useState({ tileW: 150, tileH: 80 });

  // Configure sensors for immediate drag interaction (no delay)
  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  // We use a ref to prevent double-initialization in React 18 Strict Mode,
  // but we also want to allow re-initialization if window resizes significantly (optional)
  const hasInitialized = useRef(false);

  const calculateResponsiveLayout = useCallback((wordList: string[]) => {
    const width = window.innerWidth;
    const isMobile = width < 640;
    
    // Grid Configuration
    const cols = isMobile ? 2 : 4;
    const gap = isMobile ? 8 : 12;
    const padding = 20; // Side margins
    
    // Calculate Tile Width
    const availableWidth = width - (padding * 2) - (gap * (cols - 1));
    // Cap width at 150px (desktop standard) or use available share
    const tileW = Math.min(150, Math.floor(availableWidth / cols));
    // Adjust height proportional to width or fixed small size
    const tileH = isMobile ? Math.max(60, tileW * 0.5) : 80;

    setLayoutConfig({ tileW, tileH });

    // Center grid in window
    const totalGridWidth = (cols * tileW) + ((cols - 1) * gap);
    const startX = (width - totalGridWidth) / 2;
    const startY = isMobile ? 140 : 160;

    const newWords: WordItem[] = wordList.map((text, i) => ({
      id: `word-${i}-${Date.now()}`,
      text,
      x: startX + (i % cols) * (tileW + gap),
      y: startY + Math.floor(i / cols) * (tileH + gap),
    }));

    return newWords;
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

  // Handle Resize roughly by just re-calculating if we haven't moved things? 
  // For now, let's just leave existing positions as is to avoid messing up user work,
  // but if the user wants to reset, we can re-run layout.

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (Math.abs(delta.x) === 0 && Math.abs(delta.y) === 0) return;
    
    setWords((prev) =>
      prev.map((w) => w.id === active.id ? { ...w, x: w.x + delta.x, y: w.y + delta.y } : w)
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
  };

  // Dynamic Date
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', // Abbreviated for mobile
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
    <div className="min-h-screen bg-[#f8f7f4] overflow-hidden relative touch-none select-none font-sans">
       {/* Background Grid Pattern */}
       <div 
         className="absolute inset-0 pointer-events-none opacity-30" 
         style={{
            backgroundImage: 'radial-gradient(#d6d3cd 1px, transparent 1px)',
            backgroundSize: '24px 24px'
         }}
       />

      {/* Header */}
      <div className="absolute top-0 w-full pt-4 pb-4 md:pt-8 md:pb-6 border-b border-stone-300 bg-[#f8f7f4]/95 backdrop-blur z-10 flex flex-col items-center justify-center shadow-sm px-4">
         <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-3xl font-extrabold text-stone-900 tracking-tight text-center">
                Connections — {dateStr}
            </h1>
         </div>
         <p className="text-stone-600 text-[10px] md:text-sm font-medium text-center max-w-md leading-relaxed mt-1">
           Playground Mode • Submit in Official Game
         </p>
         
         <button 
           onClick={handleResetLayout}
           className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-stone-100 hover:bg-stone-200 rounded-full text-stone-600"
           title="Reset Layout"
         >
            <RefreshCw size={16} />
         </button>
      </div>

      {errorMsg && (
          <div className="absolute top-40 left-1/2 -translate-x-1/2 z-50 text-red-700 bg-red-50 px-6 py-4 rounded-xl flex items-center gap-3 border border-red-200 shadow-lg max-w-md w-full">
              <AlertCircle size={24} className="shrink-0" />
              <span className="text-sm font-semibold">{errorMsg}</span>
          </div>
      )}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {words.map((word) => (
          <DraggableWord
            key={word.id}
            word={word}
            isSelected={selectedIds.has(word.id)}
            onToggleSelect={handleToggleSelect}
            width={layoutConfig.tileW}
            height={layoutConfig.tileH}
          />
        ))}
      </DndContext>
    </div>
  );
};

export default App;