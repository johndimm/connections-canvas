import React, { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WordItem } from '../../types';

interface DraggableWordProps {
  word: WordItem;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export const DraggableWord: React.FC<DraggableWordProps> = memo(({ word, isSelected, onToggleSelect }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: word.id,
    data: { ...word },
    disabled: word.isLocked,
  });

  const baseStyle: React.CSSProperties = {
    transform: transform
      ? `translate3d(${word.x + transform.x}px, ${word.y + transform.y}px, 0)`
      : `translate3d(${word.x}px, ${word.y}px, 0)`,
    position: 'absolute',
    touchAction: 'none',
    zIndex: isDragging ? 100 : 1,
    
    // NYT Tile Visuals - Using inline styles to override any missing Tailwind
    width: '150px',
    height: '80px',
    backgroundColor: isSelected ? '#5a594e' : '#efefe6',
    color: isSelected ? '#ffffff' : '#000000',
    borderRadius: '8px',
    
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px',
    textAlign: 'center',
    
    fontFamily: '"Libre Franklin", sans-serif',
    fontWeight: 700,
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.01em',
    lineHeight: 1.2,
    
    cursor: 'pointer',
    userSelect: 'none',
    
    // Critical 3D Shadow effect
    boxShadow: isDragging 
        ? '0 10px 25px rgba(0,0,0,0.2)' 
        : '0 2px 0 rgba(0,0,0,0.1)', 
        
    transition: 'transform 0.1s, background-color 0.15s, color 0.15s',
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
      <span style={{ pointerEvents: 'none' }}>
        {word.text}
      </span>
    </div>
  );
});

DraggableWord.displayName = 'DraggableWord';