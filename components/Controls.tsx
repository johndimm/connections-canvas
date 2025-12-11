import React from 'react';
import { Wand2, Grid, Shuffle, Check, Plus, Upload } from 'lucide-react';

interface ControlsProps {
  onShuffle: () => void;
  onResetPositions: () => void;
  onGetHints: () => void;
  onClear: () => void;
  onShare: () => void;
  isLoading: boolean;
  hasSelection: boolean;
  onSubmitSelection: () => void;
}

export const Controls: React.FC<ControlsProps> = ({ 
  onShuffle, 
  onResetPositions, 
  onGetHints,
  onClear,
  isLoading,
  hasSelection,
  onSubmitSelection
}) => {

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-50">
      
      {/* Main Action Pill */}
      <div className="bg-white border border-stone-200 shadow-xl rounded-full p-2 flex items-center gap-2">
        
        {hasSelection ? (
             <button
                onClick={onSubmitSelection}
                className="bg-black text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-stone-800 transition-all active:scale-95 animate-in zoom-in"
            >
                Submit
            </button>
        ) : (
            <>
                <button
                onClick={onShuffle}
                className="p-3 text-stone-700 hover:bg-stone-100 rounded-full transition-colors border border-transparent hover:border-stone-200"
                title="Shuffle"
                >
                <Shuffle size={20} />
                </button>
                <button
                onClick={onResetPositions}
                className="p-3 text-stone-700 hover:bg-stone-100 rounded-full transition-colors border border-transparent hover:border-stone-200"
                title="Deshuffle / Grid"
                >
                <Grid size={20} />
                </button>
            </>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-stone-200 mx-1"></div>

        <button
          onClick={onGetHints}
          disabled={isLoading}
          className={`px-4 py-2 rounded-full font-bold text-sm transition-all border flex items-center gap-2 ${
            isLoading 
              ? 'bg-stone-50 text-stone-400 border-stone-200' 
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50 hover:border-stone-400'
          }`}
        >
          <Wand2 size={16} className={isLoading ? "animate-spin" : ""} />
          <span>{isLoading ? 'Thinking...' : 'Hint'}</span>
        </button>
      </div>

      {/* Secondary Actions (Small) */}
      <div className="absolute right-[-60px] top-1/2 -translate-y-1/2 flex flex-col gap-2">
         <button
          onClick={onClear}
          className="p-2 bg-white text-stone-400 hover:text-stone-900 rounded-full shadow-md hover:shadow-lg transition-all border border-stone-100"
          title="Load New Puzzle"
        >
          <Plus size={16} />
        </button>
      </div>

    </div>
  );
};