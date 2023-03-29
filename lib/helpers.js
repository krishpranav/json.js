const LRU = require('./lru_cache');

const get = (obj, path, defaultValue) => {
  const result = String.prototype.split
    .call(path, /[,[\].]+?/)
    .filter(Boolean)
    .reduce((res, key) => (res !== null && res !== undefined ? res[key] : res), obj);
  return result === undefined || result === obj ? defaultValue : result;
};

const set = (obj, path, value) => {
  if (Object(obj) !== obj) return obj; 
  if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || [];
  path.slice(0, -1).reduce(
    (
      a,
      c,
      i 
    ) =>
      Object(a[c]) === a[c] 
        ? 
          a[c]
        : 
          (a[c] =
            
            Math.abs(path[i + 1]) >> 0 === +path[i + 1]
              ? [] 
              : {}), 
    obj
  )[path[path.length - 1]] = value; 
  return obj; 
};

const pick = (obj, arr) =>
  arr.reduce((acc, curr) => (curr in obj && (acc[curr] = obj[curr]), acc), {});

const isEmpty = (val) => val == null || !(Object.keys(val) || val).length;

const omit = (obj, arr) =>
  Object.keys(obj)
    .filter((k) => !arr.includes(k))
    .reduce((acc, key) => ((acc[key] = obj[key]), acc), {});

const isObjectLike = (val) => val !== null && typeof val === 'object';

const isPlainObject = (val) => !!val && typeof val === 'object' && val.constructor === Object;

const transform = (obj, fn, acc) => Object.keys(obj).reduce((a, k) => fn(a, obj[k], k, obj), acc);

const toKebabCase = (str) => {
  const match =
    str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);

  if (!match) {
    return str;
  }

  return match.map((x) => x.toLowerCase()).join('-');
};

const toSnakeCase = (str) => {
  const match =
    str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);

  if (!match) {
    return str;
  }

  return match.map((x) => x.toLowerCase()).join('_');
};

const toCamelCase = (str) => {
  const match =
    str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g);

  if (!match) {
    return str;
  }

  const s = match.map((x) => x.slice(0, 1).toUpperCase() + x.slice(1).toLowerCase()).join('');
  return s.slice(0, 1).toLowerCase() + s.slice(1);
};

module.exports = {
  get,
  set,
  pick,
  isEmpty,
  omit,
  isPlainObject,
  isObjectLike,
  transform,
  toKebabCase,
  toSnakeCase,
  toCamelCase,
  LRU,
};