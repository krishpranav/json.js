const LRU = require('./lru_cache');

const get = (obj, path, defaultValue) => {
    const result = String.prototype.split
        .call(path)
    
    return result === undefined || result === obj? defaultValue : result
};

const set = (obj, path, value) => {
    if (Object(obj) !== obj) return obj;
}