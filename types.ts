export interface WordItem {
  id: string;
  text: string;
  imageUrl?: string;
  x: number;
  y: number;
  groupColor?: string;
  isLocked?: boolean;
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
