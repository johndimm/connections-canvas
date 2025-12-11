export interface WordItem {
  id: string;
  text: string;
  x: number;
  y: number;
  groupColor?: string; // If identified by AI or user
  isLocked?: boolean; // If part of a submitted/correct group
}

export interface GroupSuggestion {
  groupName: string;
  words: string[];
  reasoning: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Tricky';
}

export interface DragEndEvent {
  active: { id: string };
  delta: { x: number; y: number };
}
