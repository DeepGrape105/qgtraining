import type { Node, Edge } from 'reactflow';
import type { HistoryState } from '../types';

export class HistoryManager {
  private history: HistoryState[] = [];
  private currentIndex = -1;
  private maxSize = 50;

  push(nodes: Node[], edges: Edge[]) {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    if (this.history.length > this.maxSize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo(): HistoryState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    }
    return null;
  }

  redo(): HistoryState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  hasUndo(): boolean {
    return this.currentIndex > 0;
  }

  hasRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }
}