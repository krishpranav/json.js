class Node {
    constructor(key, data) {
      this.key = key;
      this.data = data;
      this.previous = null;
      this.next = null;
    }
  }
  
  module.exports = class LRU {
    constructor(capacity) {
      this.capacity = capacity === 0 ? Infinity : capacity;
      this.map = {};
      this.head = null;
      this.tail = null;
    }
  
    get(key) {
      if (this.map[key] !== undefined) {
        const node = this.map[key];
        this._moveFirst(node);

        return node.data;
      }
  
      return undefined;
    }
  
    set(key, value) {
      if (this.map[key] !== undefined) {
        const node = this.map[key];
        node.data = value;
        this._moveFirst(node);
        return;
      }
  
      if (Object.keys(this.map).length >= this.capacity) {
        const id = this.tail.key;
        this._removeLast();
        delete this.map[id];
      }
  
      const node = new Node(key, value);
      this._add(node);
      this.map[key] = node;
    }
  
    _add(node) {
      node.next = null;
      node.previous = node.next;
  
      if (this.head === null) {
        this.head = node;
        this.tail = node;
      } else {
        this.head.previous = node;
        node.next = this.head;
        this.head = node;
      }
    }
  
    _remove(node) {
      if (this.head === node && this.tail === node) {
        this.tail = null;
        this.head = this.tail;
        return;
      }
  
      if (this.head === node) {
        this.head.next.previous = null;
        this.head = this.head.next;
        return;
      }
  
      if (this.tail === node) {
        this.tail.previous.next = null;
        this.tail = this.tail.previous;
        return;
      }
  
      node.previous.next = node.next;
      node.next.previous = node.previous;
    }
  
    _moveFirst(node) {
      this._remove(node);
      this._add(node);
    }
  
    _removeLast() {
      this._remove(this.tail);
    }
  };