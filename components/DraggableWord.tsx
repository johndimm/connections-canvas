import React, { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WordItem } from '../types';

interface DraggableWordProps {
  word: WordItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  width?: number;
  height?: number;
  scale?: number;
}

export const DraggableWord: React.FC<DraggableWordProps> = memo(({ word, isSelected, onToggleSelect, width = 150, height = 80, scale = 1 }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: word.id,
    data: { ...word },
    disabled: word.isLocked,
  });

  // Adjust transform for scale so the item follows the cursor exactly
  const x = transform ? (transform.x / scale) : 0;
  const y = transform ? (transform.y / scale) : 0;

  // Dynamic font scaling to ensure text fits
  const getFontSize = () => {
    const len = word.text.length;
    const isSmall = width < 120;
    
    if (isSmall) {
        if (len >= 12) return '10px';
        if (len >= 9) return '12px';
        if (len >= 6) return '13px';
        return '15px';
    } else {
        if (len >= 12) return '13px'; // e.g. "CONSTRUCTION"
        if (len >= 9) return '16px';  // e.g. "BUILDING"
        if (len >= 6) return '18px';  // e.g. "PLANES"
        return '20px';               // e.g. "CATS"
    }
  };

  const baseStyle: React.CSSProperties = {
    transform: `translate3d(${word.x + x}px, ${word.y + y}px, 0)`,
    position: 'absolute',
    touchAction: 'none',
    zIndex: isDragging ? 100 : 1,
    
    // Dynamic dimensions
    width: `${width}px`,
    height: `${height}px`,
    
    backgroundColor: isSelected ? '#5a594e' : '#efefe6',
    color: isSelected ? '#ffffff' : '#000000',
    borderRadius: '8px',
    
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    textAlign: 'center',
    
    fontFamily: '"Libre Franklin", sans-serif',
    fontWeight: 700,
    fontSize: getFontSize(),
    textTransform: 'uppercase',
    letterSpacing: '0.01em',
    lineHeight: 1.1,
    
    cursor: 'grab',
    userSelect: 'none',
    
    // Critical 3D Shadow effect
    boxShadow: isDragging 
        ? '0 10px 25px rgba(0,0,0,0.2)' 
        : '0 2px 0 rgba(0,0,0,0.1)', 
        
    transition: isDragging ? 'none' : 'transform 0.1s, background-color 0.15s, color 0.15s',
    opacity: isDragging ? 0.95 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={baseStyle}
      {...listeners}
      {...attributes}
      onClick={() => onToggleSelect(word.id)}
    >
      <span style={{ pointerEvents: 'none', width: '100%', wordBreak: 'break-word' }}>
        {word.text}
      </span>
    </div>
  );
});

DraggableWord.displayName = 'DraggableWord';