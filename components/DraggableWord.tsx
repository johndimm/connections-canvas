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

  const x = transform ? (transform.x / scale) : 0;
  const y = transform ? (transform.y / scale) : 0;

  const getFontSize = () => {
    // Use longest word length so no single word ever overflows and triggers mid-word breaks
    const maxWordLen = Math.max(...(word.text ?? '').split(' ').map(w => w.length || 1));
    const ratio = width / 150;

    if (maxWordLen <= 4) return `${Math.floor(28 * ratio)}px`;
    if (maxWordLen <= 6) return `${Math.floor(24 * ratio)}px`;
    if (maxWordLen <= 8) return `${Math.floor(21 * ratio)}px`;
    if (maxWordLen <= 10) return `${Math.floor(16 * ratio)}px`;
    if (maxWordLen <= 12) return `${Math.floor(13 * ratio)}px`;
    return `${Math.floor(11 * ratio)}px`;
  };

  const baseStyle: React.CSSProperties = {
    transform: `translate3d(${word.x + x}px, ${word.y + y}px, 0)`,
    position: 'absolute',
    touchAction: 'none',
    zIndex: isDragging ? 100 : 1,
    
    width: `${width}px`,
    height: `${height}px`,
    
    backgroundColor: isSelected ? '#5a594e' : '#efefe6',
    color: isSelected ? '#ffffff' : '#000000',
    borderRadius: '6px',
    
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: word.imageUrl ? '0' : '8px',
    textAlign: 'center',
    
    fontFamily: '"Libre Franklin", sans-serif',
    fontWeight: 800,
    fontSize: getFontSize(),
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
    lineHeight: 1,
    
    cursor: 'grab',
    userSelect: 'none',
    
    boxShadow: isDragging 
        ? '0 12px 30px rgba(0,0,0,0.15)' 
        : '0 1px 2px rgba(0,0,0,0.05)',
        
    transition: isDragging ? 'none' : 'transform 0.1s, background-color 0.1s, color 0.1s',
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={baseStyle}
      {...listeners}
      {...attributes}
      onClick={() => onToggleSelect(word.id)}
    >
      {word.imageUrl ? (
        <img
          src={word.imageUrl}
          alt={word.text}
          style={{
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: '6px',
            filter: isSelected ? 'invert(1)' : 'invert(0)',
          }}
        />
      ) : (
        <span style={{ pointerEvents: 'none', width: '100%', overflowWrap: 'normal', display: 'block' }}>
          {word.text}
        </span>
      )}
    </div>
  );
});

DraggableWord.displayName = 'DraggableWord';