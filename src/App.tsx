import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { WordItem } from '../types';
import { DraggableWord } from './components/DraggableWord';
import { fetchDailyPuzzle } from '../services/geminiService';
import { Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Move } from 'lucide-react';

const STORAGE_KEY = `connections-canvas-${new Date().toLocaleDateString('en-CA')}`;

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
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [layoutConfig, setLayoutConfig] = useState({ tileW: 150, tileH: 80 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef<number | null>(null);
  const activeTouches = useRef(0);
  const hasInitialized = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const calculateResponsiveLayout = useCallback((wordList: string[]) => {
    const cols = 4, gap = 16, tileW = 150, tileH = 80;
    const totalW = (cols * tileW) + ((cols - 1) * gap);
    const screenW = window.innerWidth;
    let scale = screenW < totalW + 40 ? (screenW - 40) / totalW : 1;
    scale = Math.max(0.4, Math.min(1.2, scale));
    const startViewportX = (screenW - totalW * scale) / 2;
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
    const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(shuffle(newWordList));
    setWords(newWords);
    setViewport(newViewport);
    setIsInitializing(false);
    hasInitialized.current = true;
  }, [calculateResponsiveLayout]);

  useEffect(() => {
    if (hasInitialized.current) return;
    fetchDailyPuzzle()
      .then(({ words: fetchedWords }) => {
        const wordList = fetchedWords.slice(0, 16);
        try {
          const savedRaw = localStorage.getItem(STORAGE_KEY);
          if (savedRaw) {
            const saved = JSON.parse(savedRaw);
            const savedTexts = new Set<string>(saved.words.map((w: WordItem) => w.text));
            if (saved.words.length === wordList.length && wordList.every(t => savedTexts.has(t))) {
              setWords(saved.words);
              setViewport(saved.viewport);
              setIsInitializing(false);
              hasInitialized.current = true;
              return;
            }
          }
        } catch {}
        initializeBoard(wordList);
      })
      .catch(err => {
        console.error("Init error:", err);
        setErrorMsg("Could not load today's puzzle. Please try again later.");
        setIsInitializing(false);
      });
  }, [initializeBoard]);

  useEffect(() => {
    if (words.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ words, viewport }));
  }, [words, viewport]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-draggable="true"]')) return;
    isPanning.current = true;
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastPanPoint.current.x;
    const dy = e.clientY - lastPanPoint.current.y;
    setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastPanPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanning.current = false;
    lastPinchDist.current = null;
    if (e.target instanceof HTMLElement && e.target.hasPointerCapture(e.pointerId))
      e.target.releasePointerCapture(e.pointerId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    activeTouches.current = e.touches.length;
    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (lastPinchDist.current !== null) {
        const zoomFactor = (dist - lastPinchDist.current) * 0.005;
        setViewport(prev => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale + zoomFactor)) }));
      }
      lastPinchDist.current = dist;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (Math.abs(delta.x) === 0 && Math.abs(delta.y) === 0) return;
    setWords(prev => prev.map(w =>
      w.id === active.id ? { ...w, x: w.x + delta.x / viewport.scale, y: w.y + delta.y / viewport.scale } : w
    ));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const handleResetLayout = () => {
    const { words: newWords, viewport: newViewport } = calculateResponsiveLayout(words.map(w => w.text));
    setWords(newWords);
    setViewport(newViewport);
  };

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
      onTouchStart={e => { activeTouches.current = e.touches.length; }}
      onTouchMove={handleTouchMove}
      onTouchEnd={e => { activeTouches.current = e.touches.length; if (e.touches.length < 2) lastPinchDist.current = null; }}
      onWheel={e => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setViewport(prev => ({ ...prev, scale: Math.max(0.1, Math.min(3, prev.scale - e.deltaY * 0.001)) }));
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

      <div
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
      >
        <div
          className="absolute flex flex-col items-center justify-end pb-4 pointer-events-none"
          style={{ left: 0, top: -150, width: totalGridWidth, height: 150 }}
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
          </p>
        </div>

        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
          cancelDrop={() => activeTouches.current > 1}
        >
          {words.map(word => (
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

      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-20 pointer-events-auto">
        <button onClick={handleResetLayout} className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200 mb-2" title="Reset Layout">
          <RefreshCw size={24} />
        </button>
        <button onClick={() => setViewport(prev => ({ ...prev, scale: Math.min(3, prev.scale + 0.1) }))} className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200">
          <ZoomIn size={24} />
        </button>
        <button onClick={() => setViewport(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }))} className="p-3 bg-white shadow-lg rounded-full text-stone-700 hover:bg-stone-50 active:scale-95 border border-stone-200">
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
