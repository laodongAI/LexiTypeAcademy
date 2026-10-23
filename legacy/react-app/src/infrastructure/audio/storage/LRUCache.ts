/**
 * LRU缓存节点
 */
class LRUNode<K, V> {
  constructor(
    public key: K,
    public value: V,
    public prev: LRUNode<K, V> | null = null,
    public next: LRUNode<K, V> | null = null
  ) {}
}

/**
 * LRU (Least Recently Used) 缓存
 * 使用双向链表实现，O(1)时间复杂度
 */
export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('LRU缓存容量必须大于0');
    }
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * 获取缓存项
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    if (!node) {
      return undefined;
    }

    // 将访问的节点移动到链表头部（最近使用）
    this.moveToHead(node);
    return node.value;
  }

  /**
   * 设置缓存项
   */
  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // 更新已有节点
      existingNode.value = value;
      this.moveToHead(existingNode);
    } else {
      // 创建新节点
      const newNode = new LRUNode(key, value);
      this.cache.set(key, newNode);
      this.addToHead(newNode);

      // 如果超过容量，移除尾部节点（最久未使用）
      if (this.cache.size > this.capacity) {
        const tailKey = this.removeTail();
        if (tailKey !== undefined) {
          this.cache.delete(tailKey);
        }
      }
    }
  }

  /**
   * 删除缓存项
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  /**
   * 检查缓存项是否存在
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * 获取所有键
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取所有值
   */
  values(): V[] {
    return Array.from(this.cache.values()).map((node) => node.value);
  }

  /**
   * 遍历缓存（从最近使用到最久未使用）
   */
  forEach(callback: (value: V, key: K) => void): void {
    let current = this.head;
    while (current) {
      callback(current.value, current.key);
      current = current.next;
    }
  }

  /**
   * 将节点移动到链表头部
   */
  private moveToHead(node: LRUNode<K, V>): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * 将节点添加到链表头部
   */
  private addToHead(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * 从链表中移除节点
   */
  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * 移除尾部节点（最久未使用）
   */
  private removeTail(): K | undefined {
    if (!this.tail) {
      return undefined;
    }

    const key = this.tail.key;
    this.removeNode(this.tail);
    return key;
  }
}
