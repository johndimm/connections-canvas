import React, { useState } from 'react';
import { RefreshCw, Wand2, Grid, Shuffle, CheckCircle, Trash2, Share2, Check } from 'lucide-react';

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
  onShare,
  isLoading,
  hasSelection,
  onSubmitSelection
}) => {
  const [copied, setCopied] = useState(false);

  const handleShareClick = () => {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 border border-stone-200 z-50 transition-all">
      <div className="flex items-center gap-2 pr-4 border-r border-stone-200">
        <button
          onClick={onShuffle}
          className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors tooltip"
          title="Shuffle Words"
        >
          <Shuffle size={20} />
        </button>
        <button
          onClick={onResetPositions}
          className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
          title="Grid View"
        >
          <Grid size={20} />
        </button>
         <button
          onClick={onClear}
          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Clear Board"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3">
         {hasSelection && (
            <button
                onClick={onSubmitSelection}
                className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-full font-semibold hover:bg-stone-700 transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
                <CheckCircle size={18} />
                <span>Submit Group</span>
            </button>
         )}

        {!hasSelection && (
           <button
             onClick={handleShareClick}
             className="p-2 text-stone-600 hover:bg-stone-100 rounded-full transition-colors flex items-center gap-2"
             title="Share Puzzle Link"
           >
             {copied ? <Check size={20} className="text-green-600"/> : <Share2 size={20} />}
           </button>
        )}

        <button
          onClick={onGetHints}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-all shadow-md ${
            isLoading 
              ? 'bg-purple-100 text-purple-400 cursor-wait' 
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105 active:scale-95'
          }`}
        >
          <Wand2 size={18} className={isLoading ? "animate-spin" : ""} />
          <span>{isLoading ? 'Thinking...' : 'AI Hint'}</span>
        </button>
      </div>
    </div>
  );
};
