// Priority Queue implementation for high-performance transaction processing

export class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];
  private compareFn: (a: T, b: T) => boolean;

  constructor(compareFn: (a: T, b: T) => boolean) {
    this.compareFn = compareFn;
  }

  enqueue(item: T, priority?: number): void {
    const queueItem = {
      item,
      priority: priority ?? this.calculatePriority(item),
    };

    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (queueItem.priority > this.items[i].priority) {
        this.items.splice(i, 0, queueItem);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueItem);
    }
  }

  dequeue(): T | undefined {
    const item = this.items.shift();
    return item?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  private calculatePriority(item: T): number {
    // Default priority calculation
    return 0;
  }
}
