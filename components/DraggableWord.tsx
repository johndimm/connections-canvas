import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WordItem } from '../types';

interface DraggableWordProps {
  word: WordItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export const DraggableWord: React.FC<DraggableWordProps> = ({ word, isSelected, onToggleSelect }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: word.id,
    data: { ...word },
    disabled: word.isLocked,
  });

  // Calculate position style
  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${word.x + transform.x}px, ${word.y + transform.y}px, 0)`
      : `translate3d(${word.x}px, ${word.y}px, 0)`,
    position: 'absolute',
    touchAction: 'none',
    zIndex: isDragging ? 100 : 1,
  };

  // Determine colors based on state
  const baseClasses = "flex items-center justify-center w-36 h-20 rounded-lg shadow-sm border transition-all duration-200 select-none cursor-grab active:cursor-grabbing text-center p-2 font-bold uppercase text-sm tracking-wide";
  
  let colorClasses = "bg-white border-stone-300 text-stone-800 hover:shadow-md hover:-translate-y-0.5";
  
  if (word.isLocked) {
    colorClasses = "bg-stone-200 border-stone-200 text-stone-500 cursor-default opacity-80";
  } else if (word.groupColor) {
    // AI Suggested colors
    colorClasses = `${word.groupColor} text-white border-transparent shadow-md`;
  } else if (isSelected) {
    colorClasses = "bg-stone-800 text-white border-stone-800 scale-105 shadow-xl ring-2 ring-stone-400 ring-offset-2";
  } else if (isDragging) {
    colorClasses = "bg-stone-50 border-stone-400 shadow-xl scale-110 opacity-90 z-50";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`${baseClasses} ${colorClasses}`}
      onClick={(e) => {
          // The drag sensor has an activation constraint of 5px. 
          // Clicks without movement will fire this event to toggle selection.
          onToggleSelect(word.id);
      }}
    >
      <span className="pointer-events-none">{word.text}</span>
    </div>
  );
};
