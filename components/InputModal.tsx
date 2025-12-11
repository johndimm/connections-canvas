import React, { useState, useRef } from 'react';
import { ClipboardList, Play, RotateCcw, Image as ImageIcon, Loader2, Globe } from 'lucide-react';
import { extractWordsFromImage, fetchDailyPuzzle } from '../services/geminiService';

interface InputModalProps {
  isOpen: boolean;
  onStart: (words: string[]) => void;
  onClose: () => void; // Used if we want to cancel
}

const PRESETS = [
    {
        name: "Demo Puzzle",
        words: [
            "STALK", "SHOOT", "SPEAR", "BLADE", // Parts of a plant
            "RUSH", "HURRY", "DASH", "SCRAMBLE", // Move quickly
            "BEAR", "LION", "TIGER", "WOLF", // Animals (decoy)
            "STOCK", "SHARE", "BOND", "FUND" // Finance
        ]
    }
];

export const InputModal: React.FC<InputModalProps> = ({ isOpen, onStart }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParse = () => {
    // Split by comma, newline, or tab
    const separators = /[\n,;\t]+/;
    const rawWords = text.split(separators).map(w => w.trim().toUpperCase()).filter(w => w.length > 0);
    
    // Remove duplicates
    const uniqueWords = Array.from(new Set(rawWords));

    if (uniqueWords.length !== 16) {
      setError(`We need exactly 16 unique words. You have ${uniqueWords.length}.`);
      return;
    }

    onStart(uniqueWords);
  };

  const loadPreset = () => {
      setText(PRESETS[0].words.join("\n"));
      setError('');
  };

  const handleLoadDaily = async () => {
      setIsAnalyzing(true);
      setError('');
      try {
          const { words, source } = await fetchDailyPuzzle();
          if (words.length > 0) {
              setText(words.join("\n"));
              if (words.length === 16) {
                  // If we are confident, just start
                  // onStart(words); // Optional: Uncomment to auto-start if perfect
                  setError(`Loaded today's words${source ? ` from ${source}` : ''}. Click Start!`);
              } else {
                  setError(`Found ${words.length} words${source ? ` from ${source}` : ''}. Please check and fix.`);
              }
          } else {
              setError("Could not find today's puzzle. Try uploading a screenshot instead.");
          }
      } catch (e) {
          setError("Failed to search for daily puzzle.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError('');

    try {
      // Convert to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data url prefix (e.g. "data:image/jpeg;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });

      const extractedWords = await extractWordsFromImage(base64Data, file.type);
      
      if (extractedWords && extractedWords.length === 16) {
        // Success! Immediately start the game.
        onStart(extractedWords);
      } else if (extractedWords && extractedWords.length > 0) {
        setText(extractedWords.join("\n"));
        setError(`Found ${extractedWords.length} words. Please verify the list and click "Start Canvas".`);
      } else {
        setError("Could not find words in the image. Please try again or type manually.");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
      // Reset input so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-stone-200">
        <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                <ClipboardList className="text-stone-500" />
                New Board
            </h2>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-stone-600 text-sm">
            Paste your 16 words below, upload a screenshot, or search for today's puzzle.
          </p>
          
          <div className="relative">
             <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-48 p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-stone-400 focus:outline-none font-mono text-sm resize-none uppercase"
                placeholder="WORD1 WORD2 WORD3..."
                disabled={isAnalyzing}
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-xl">
                  <Loader2 className="animate-spin text-stone-800 mb-2" size={32} />
                  <span className="text-sm font-semibold text-stone-800">Analyzing...</span>
                </div>
              )}
          </div>
          
          {error && (
            <div className={`text-sm font-medium p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 ${error.includes('Loaded') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                {error.includes('Loaded') ? '✅' : '⚠️'} {error}
            </div>
          )}

          <div className="flex gap-2 justify-between pt-2">
            <div className="flex gap-2">
               <input 
                 type="file" 
                 accept="image/*" 
                 className="hidden" 
                 ref={fileInputRef}
                 onChange={handleFileSelect}
               />
               <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium text-xs transition-colors flex items-center gap-2 border border-stone-200"
                title="Upload Screenshot"
              >
                <ImageIcon size={14} />
                <span className="hidden sm:inline">Image</span>
              </button>
               <button
                onClick={handleLoadDaily}
                disabled={isAnalyzing}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-medium text-xs transition-colors flex items-center gap-2 border border-stone-200"
                title="Search Web for Today's Puzzle"
              >
                <Globe size={14} />
                <span className="hidden sm:inline">Daily</span>
              </button>
               <button
                onClick={loadPreset}
                disabled={isAnalyzing}
                className="px-3 py-2 text-stone-500 hover:text-stone-800 font-medium text-xs transition-colors flex items-center gap-1"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Demo</span>
              </button>
            </div>

            <button
              onClick={handleParse}
              disabled={isAnalyzing}
              className="px-6 py-2 bg-black text-white rounded-lg font-bold hover:bg-stone-800 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play size={16} fill="white" />
              Start Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};