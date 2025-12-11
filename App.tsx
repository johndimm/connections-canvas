import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { WordItem, GroupSuggestion } from './types';
import { DraggableWord } from './components/DraggableWord';
import { InputModal } from './components/InputModal';
import { Controls } from './components/Controls';
import { getConnectionsHints } from './services/geminiService';
import { BrainCircuit, X } from 'lucide-react';

// Colors for the 4 groups (NYT Style inspired)
const GROUP_COLORS = [
  'bg-yellow-500 border-yellow-600',
  'bg-green-500 border-green-600',
  'bg-blue-500 border-blue-600',
  'bg-purple-500 border-purple-600',
];

const App: React.FC = () => {
  const [words, setWords] = useState<WordItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSetupOpen, setIsSetupOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<GroupSuggestion[]>([]);

  // Configure sensors for drag interactions
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  // Initialize board layout
  const initializeBoard = useCallback((newWordList: string[]) => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Create a rough grid in the center
    const cols = 4;
    const cardW = 160; // Approximate with margin
    const cardH = 100;
    const startX = (screenWidth - (cols * cardW)) / 2;
    const startY = 100;

    const newWords: WordItem[] = newWordList.map((text, i) => ({
      id: `word-${i}-${Date.now()}`,
      text,
      x: startX + (i % cols) * cardW,
      y: startY + Math.floor(i / cols) * cardH,
    }));

    setWords(newWords);
    setIsSetupOpen(false);
    setSolvedGroups([]);
    setSuggestions([]);
    setSelectedIds(new Set());
  }, []);

  // Check for URL param on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const puzzleData = params.get('p');
    if (puzzleData) {
      try {
        const decoded = atob(puzzleData);
        const loadedWords = JSON.parse(decoded);
        if (Array.isArray(loadedWords) && loadedWords.length === 16) {
          initializeBoard(loadedWords);
        }
      } catch (e) {
        console.error("Failed to load puzzle from URL", e);
      }
    }
  }, [initializeBoard]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setWords((prev) =>
      prev.map((w) => {
        if (w.id === active.id) {
          return { ...w, x: w.x + delta.x, y: w.y + delta.y };
        }
        return w;
      })
    );
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size < 4) {
           next.add(id);
        }
      }
      return next;
    });
  };

  const handleShuffle = () => {
    // Randomize positions slightly or completely re-grid
    // Let's scatter them but keep them visible
    const w = window.innerWidth - 200;
    const h = window.innerHeight - 300;
    
    setWords(prev => prev.map(word => {
        if (word.isLocked) return word;
        return {
            ...word,
            x: 50 + Math.random() * w,
            y: 50 + Math.random() * h
        }
    }));
  };

  const handleResetPositions = () => {
      // Re-grid unlocked words
      const screenWidth = window.innerWidth;
      const cols = 4;
      const cardW = 160;
      const cardH = 100;
      const startX = (screenWidth - (cols * cardW)) / 2;
      const startY = 150; // below solved ones if any?

      // Separate locked and unlocked
      const unlocked = words.filter(w => !w.isLocked);
      const locked = words.filter(w => w.isLocked);

      // We only re-arrange unlocked ones
      const reorderedUnlocked = unlocked.map((word, i) => ({
          ...word,
          x: startX + (i % cols) * cardW,
          y: startY + Math.floor(i / cols) * cardH + (locked.length > 0 ? 150 : 0) // Push down if some are solved
      }));

      // Combine back, keeping locked ones where they are (or moving them to top?)
      // Actually, standard UI moves solved to top.
      // Let's just grid the active ones for now.
      setWords([...locked, ...reorderedUnlocked]);
  };

  const handleGetHints = async () => {
    setIsLoading(true);
    try {
      const allWordTexts = words.map(w => w.text);
      const hints = await getConnectionsHints(allWordTexts);
      setSuggestions(hints);
    } catch (error) {
      alert("Could not retrieve hints. Please check your API key or try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = (suggestion: GroupSuggestion, index: number) => {
      // Find the word IDs for this suggestion
      const wordsToGroup = words.filter(w => suggestion.words.includes(w.text));
      
      if (wordsToGroup.length !== 4) {
          console.warn("Could not match all suggestion words to board words");
          return;
      }

      const color = GROUP_COLORS[index % GROUP_COLORS.length];

      setWords(prev => prev.map(w => {
          if (suggestion.words.includes(w.text)) {
              return { ...w, groupColor: color, isLocked: true };
          }
          return w;
      }));

      setSolvedGroups(prev => [...prev, suggestion]);
      setSuggestions(prev => prev.filter(s => s !== suggestion));
      
      // Clear selection if it contained these
      setSelectedIds(new Set());
  };

  // Organize solved groups visually at the top
  useEffect(() => {
    if (solvedGroups.length > 0) {
        // We want to move the solved words to the top of the screen in a neat row/grid
        const cardW = 150; // slightly smaller
        const startX = (window.innerWidth - (4 * cardW)) / 2;
        
        setWords(prev => {
            let nextWords = [...prev];
            solvedGroups.forEach((group, groupIdx) => {
                const groupWords = group.words;
                groupWords.forEach((wordText, wordIdx) => {
                    // Find the word in the array
                    const wIndex = nextWords.findIndex(w => w.text === wordText);
                    if (wIndex !== -1) {
                         nextWords[wIndex] = {
                             ...nextWords[wIndex],
                             x: startX + (wordIdx * cardW),
                             y: 20 + (groupIdx * 90), // Stack groups at top
                             isLocked: true
                         };
                    }
                });
            });
            return nextWords;
        });
    }
  }, [solvedGroups.length]); // Only run when a new group is added

  const handleManualSubmit = () => {
      // In a real game, this checks correctness.
      if (suggestions.length > 0) {
          const selectedWords = words.filter(w => selectedIds.has(w.id)).map(w => w.text);
          const match = suggestions.find(s => 
              s.words.every(sw => selectedWords.includes(sw)) && selectedWords.every(sw => s.words.includes(sw))
          );

          if (match) {
              // It's correct based on AI knowledge!
              const index = solvedGroups.length;
              applySuggestion(match, index);
              return;
          }
      }
      setSelectedIds(new Set());
  };

  const handleShare = () => {
    if (words.length === 0) return;
    const wordList = words.map(w => w.text);
    // Remove duplicates just in case, though logic handles it
    const unique = Array.from(new Set(wordList));
    const encoded = btoa(JSON.stringify(unique));
    const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="min-h-screen bg-stone-100 overflow-hidden relative touch-none">
      
      {/* Header / Title */}
      <div className="absolute top-0 left-0 p-6 pointer-events-none z-0">
         <h1 className="text-3xl font-bold text-stone-300 tracking-tight">CONNECTIONS<br/><span className="text-stone-400 text-lg font-normal">CANVAS</span></h1>
      </div>

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

      <Controls 
        onShuffle={handleShuffle}
        onResetPositions={handleResetPositions}
        onGetHints={handleGetHints}
        onClear={() => setIsSetupOpen(true)}
        onShare={handleShare}
        isLoading={isLoading}
        hasSelection={selectedIds.size === 4}
        onSubmitSelection={handleManualSubmit}
      />

      <InputModal 
        isOpen={isSetupOpen} 
        onStart={initializeBoard} 
        onClose={() => setIsSetupOpen(false)}
      />

      {/* AI Suggestions Panel (Slide in) */}
      {suggestions.length > 0 && (
          <div className="fixed top-4 right-4 z-40 w-80 bg-white/90 backdrop-blur shadow-xl rounded-xl border border-purple-100 p-4 max-h-[80vh] overflow-y-auto no-scrollbar transition-all animate-in slide-in-from-right">
              <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-stone-800 flex items-center gap-2">
                      <BrainCircuit size={18} className="text-purple-600"/> 
                      AI Insights
                  </h3>
                  <button onClick={() => setSuggestions([])} className="text-stone-400 hover:text-stone-600">
                      <X size={16} />
                  </button>
              </div>
              <div className="space-y-3">
                  {suggestions.map((s, idx) => (
                      <div key={idx} className="bg-white border border-stone-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-1">
                             <span className="text-xs font-bold uppercase tracking-wider text-stone-500">{s.difficulty}</span>
                             <button 
                                onClick={() => applySuggestion(s, solvedGroups.length + idx)}
                                className="text-xs bg-stone-900 text-white px-2 py-1 rounded hover:bg-stone-700"
                             >
                                Reveal
                             </button>
                          </div>
                          <p className="font-bold text-sm text-stone-900 mb-1">{s.groupName}</p>
                          <p className="text-xs text-stone-600 italic mb-2">{s.reasoning}</p>
                          <div className="flex flex-wrap gap-1">
                              {s.words.map(w => (
                                  <span key={w} className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 border border-stone-200">
                                      {w}
                                  </span>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {/* Solved Groups Overlay Information (Optional, purely visual for now they just lock to top) */}
      {solvedGroups.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 pointer-events-none z-0">
             {solvedGroups.map((g, i) => (
                 <div key={i} className={`text-xs font-bold px-3 py-1 rounded-full text-white/50 text-center ${GROUP_COLORS[i].split(' ')[0]}`} style={{marginTop: i === 0 ? '0' : '70px'}}>
                     {g.groupName}
                 </div>
             ))}
        </div>
      )}

    </div>
  );
};

export default App;
