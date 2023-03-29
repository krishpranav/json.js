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
    }

    _moveFirst(node) {
        this._remove(node);
        this._add(node);
    }

    _removeLast() {
        this._remove(this.tail);
    }
};