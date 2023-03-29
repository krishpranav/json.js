function validateOptions(options) {
    options = {
      id: 'id',
      blacklist: [],
      whitelist: [],
      links: {},
      relationships: {},
      topLevelLinks: {},
      topLevelMeta: {},
      meta: {},
      blacklistOnDeserialize: [],
      whitelistOnDeserialize: [],
      jsonapiObject: true,
      ...options,
    };
  
    if (!Array.isArray(options.blacklist)) throw new Error("option 'blacklist' must be an array");
    if (!Array.isArray(options.whitelist)) throw new Error("option 'whitelist' must be an array");
    if (typeof options.links !== 'object' && typeof options.links !== 'function')
      throw new Error("option 'links' must be an object or a function");
    if (!Array.isArray(options.blacklistOnDeserialize))
      throw new Error("option 'blacklistOnDeserialize' must be an array");
    if (!Array.isArray(options.whitelistOnDeserialize))
      throw new Error("option 'whitelistOnDeserialize' must be an array");
    if (
      options.topLevelLinks &&
      typeof options.topLevelLinks !== 'object' &&
      typeof options.topLevelLinks !== 'function'
    )
      throw new Error("option 'topLevelLinks' must be an object or a function");
    if (
      options.topLevelMeta &&
      typeof options.topLevelMeta !== 'object' &&
      typeof options.topLevelMeta !== 'function'
    )
      throw new Error("option 'topLevelMeta' must be an object or a function");
    if (options.meta && typeof options.meta !== 'object' && typeof options.meta !== 'function')
      throw new Error("option 'meta' must be an object or a function");
    if (typeof options.jsonapiObject !== 'boolean')
      throw new Error("option 'jsonapiObject' must a boolean");
    if (
      options.convertCase &&
      !['kebab-case', 'snake_case', 'camelCase'].includes(options.convertCase)
    )
      throw new Error("option 'convertCase' must be one of 'kebab-case', 'snake_case', 'camelCase'");
  
    if (
      options.unconvertCase &&
      !['kebab-case', 'snake_case', 'camelCase'].includes(options.unconvertCase)
    )
      throw new Error(
        "option 'unconvertCase' must be one of 'kebab-case', 'snake_case', 'camelCase'"
      );
  
    if (options.beforeSerialize && typeof options.beforeSerialize !== 'function')
      throw new Error("option 'beforeSerialize' must be function");
  
    if (options.afterDeserialize && typeof options.afterDeserialize !== 'function')
      throw new Error("option 'afterDeserialize' must be function");
  
    const { relationships } = options;
    Object.keys(relationships).forEach((key) => {
      relationships[key] = {
        schema: 'default',
        links: {},
        meta: {},
        ...relationships[key],
      };
  
      if (!relationships[key].type)
        throw new Error(`option 'type' for relationship '${key}' is required`);
      if (
        typeof relationships[key].type !== 'string' &&
        typeof relationships[key].type !== 'function'
      )
        throw new Error(`option 'type' for relationship '${key}' must be a string or a function`);
      if (relationships[key].alternativeKey && typeof relationships[key].alternativeKey !== 'string')
        throw new Error(`option 'alternativeKey' for relationship '${key}' must be a string`);
  
      if (relationships[key].schema && typeof relationships[key].schema !== 'string')
        throw new Error(`option 'schema' for relationship '${key}' must be a string`);
  
      if (
        typeof relationships[key].links !== 'object' &&
        typeof relationships[key].links !== 'function'
      )
        throw new Error(`option 'links' for relationship '${key}' must be an object or a function`);
  
      if (
        typeof relationships[key].meta !== 'object' &&
        typeof relationships[key].meta !== 'function'
      )
        throw new Error(`option 'meta' for relationship '${key}' must be an object or a function`);
  
      if (relationships[key].deserialize && typeof relationships[key].deserialize !== 'function')
        throw new Error(`option 'deserialize' for relationship '${key}' must be a function`);
    });
  
    return options;
  }
  
  function validateDynamicTypeOptions(options) {
    options = { topLevelLinks: {}, topLevelMeta: {}, jsonapiObject: true, ...options };
  
    if (!options.type) throw new Error("option 'type' is required");
    if (typeof options.type !== 'string' && typeof options.type !== 'function') {
      throw new Error("option 'type' must be a string or a function");
    }
  
    if (
      options.topLevelLinks &&
      typeof options.topLevelLinks !== 'object' &&
      typeof options.topLevelLinks !== 'function'
    )
      throw new Error("option 'topLevelLinks' must be an object or a function");
    if (
      options.topLevelMeta &&
      typeof options.topLevelMeta !== 'object' &&
      typeof options.topLevelMeta !== 'function'
    )
      throw new Error("option 'topLevelMeta' must be an object or a function");
    if (options.meta && typeof options.meta !== 'object' && typeof options.meta !== 'function')
      throw new Error("option 'meta' must be an object or a function");
    if (typeof options.jsonapiObject !== 'boolean')
      throw new Error("option 'jsonapiObject' must a boolean");
  
    return options;
  }

  function validateError(err) {
    if (typeof err !== 'object') {
      throw new Error('error must be an object');
    }
  
    const { id, links, status, statusCode, code, title, detail, source, meta } = err;
  
    const isValidLink = function isValidLink(linksObj) {
      const permittedMembers = ['about'];
  
      if (typeof linksObj !== 'object') {
        throw new Error("error 'link' property must be an object");
      }
  
      Object.keys(linksObj).forEach((key) => {
        if (!permittedMembers.includes(key)) {
          throw new Error(`error 'links.${key}' is not permitted`);
        }
      });
  
      if (linksObj.about && typeof linksObj.about !== 'string') {
        throw new Error("'links.about' property must be a string");
      }
  
      return links;
    };
  
    const isValidSource = function isValidSource(sourceObj) {
      const permittedMembers = ['pointer', 'parameter'];
  
      if (typeof sourceObj !== 'object') {
        throw new Error("error 'source' property must be an object");
      }
  
      Object.keys(sourceObj).forEach((key) => {
        if (!permittedMembers.includes(key)) {
          throw new Error(`error 'source.${key}' is not permitted`);
        }
      });
  
      if (sourceObj.pointer && typeof sourceObj.pointer !== 'string') {
        throw new Error("error 'source.pointer' property must be a string");
      }
  
      if (sourceObj.parameter && typeof sourceObj.parameter !== 'string') {
        throw new Error("error 'source.parameter' property must be a string");
      }
  
      return source;
    };
  
    const isValidMeta = function isValidMeta(metaObj) {
      if (typeof metaObj !== 'object') {
        throw new Error("error 'meta' property must be an object");
      }
  
      return meta;
    };

    const isValidHttpStatusCode = function isValidHttpStatusCode(theStatusCode) {
      const validHttpStatusCodes = [
        100,101, 102, 
  
        200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 
  
        300, 301, 302, 303, 304, 305, 307, 308, 
  
        400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 
        413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 429, 
        431, 444, 451, 499, 
  
        500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511, 599 
      ];
  
      return validHttpStatusCodes.includes(theStatusCode);
    };
  
    const isValidStatus = function isValidStatus(theStatusCode) {
      const statusAsNumber = Number(theStatusCode);
  
      if (Number.isNaN(statusAsNumber)) {
        throw new Error("error 'status' must be a number");
      }
  
      if (!isValidHttpStatusCode(statusAsNumber)) {
        throw new Error("error 'status' must be a valid HTTP status code");
      }
  
      return statusAsNumber.toString();
    };
  
    const error = {};
    if (id) error.id = id;
    if (links && Object.keys(links).length) error.links = isValidLink(links);
    if (status || statusCode) error.status = isValidStatus(status || statusCode);
    if (code) error.code = code.toString();
    if (title) {
      error.title = title.toString();
    } else if (err.constructor.name !== 'Object') {
      error.title = err.constructor.name;
    }
    error.detail = detail ? detail.toString() : err.message;
    if (source && Object.keys(source).length) error.source = isValidSource(source);
    if (meta && Object.keys(meta).length) error.meta = isValidMeta(meta);
  
    return error;
  }
  
  module.exports = {
    validateOptions,
    validateDynamicTypeOptions,
    validateError,
  };