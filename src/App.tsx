import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { WordItem } from '../types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from '../services/geminiService';
import { Loader2, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Configure sensors for immediate drag interaction (no delay)
  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  const initializeBoard = useCallback((newWordList: string[]) => {
    // Basic layout calculation
    const screenWidth = window.innerWidth;
    const cols = 4;
    const gap = 12; 
    const tileW = 150;
    const tileH = 80;
    const totalW = (cols * tileW) + ((cols - 1) * gap);
    
    // Center horizontally, ensure margin
    const startX = Math.max(20, (screenWidth - totalW) / 2);
    // Start vertically
    const startY = 160;

    const newWords: WordItem[] = newWordList.map((text, i) => ({
      id: `word-${i}-${Date.now()}`,
      text,
      x: startX + (i % cols) * (tileW + gap),
      y: startY + Math.floor(i / cols) * (tileH + gap),
    }));

    setWords(newWords);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const { words } = await fetchDailyPuzzle();
        if (words && words.length > 0) {
           // If we got more than 16, just take first 16, if less, we still show them
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    // Even with no delay, we only update position if there was actual movement
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

  // Dynamic Date
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric'
  });

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-stone-800 mb-6" size={40} />
        <p className="text-stone-600 font-sans">Loading today's puzzle...</p>
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
      <div className="absolute top-0 w-full pt-8 pb-6 border-b border-stone-300 bg-[#f8f7f4]/95 backdrop-blur z-10 flex flex-col items-center justify-center shadow-sm px-4">
         <h1 className="text-xl md:text-3xl font-extrabold text-stone-900 tracking-tight text-center mb-2">
           Connections — {dateStr}
         </h1>
         <p className="text-stone-600 text-xs md:text-sm font-medium text-center max-w-md leading-relaxed">
           Drag tiles to experiment with groups. <br/>
           <span className="text-stone-400">Note: This is a playground. Submit your guesses in the official NYT Game.</span>
         </p>
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
          />
        ))}
      </DndContext>
    </div>
  );
};

export default App;