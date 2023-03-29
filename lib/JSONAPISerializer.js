require('setimmediate');

const {
  pick,
  isEmpty,
  omit,
  isPlainObject,
  isObjectLike,
  transform,
  get,
  set,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  LRU,
} = require('./helpers');

const { validateOptions, validateDynamicTypeOptions, validateError } = require('./validator');

module.exports = class JSONAPISerializer {
  constructor(opts) {
    this.opts = opts || {};
    this.schemas = {};

    const { convertCaseCacheSize = 5000 } = this.opts;

    this.convertCaseMap = {
      camelCase: new LRU(convertCaseCacheSize),
      kebabCase: new LRU(convertCaseCacheSize),
      snakeCase: new LRU(convertCaseCacheSize),
    };
  }

  register(type, schema, options) {
    if (typeof schema === 'object') {
      options = schema;
      schema = 'default';
    }

    schema = schema || 'default';
    options = { ...this.opts, ...options };

    this.schemas[type] = this.schemas[type] || {};
    this.schemas[type][schema] = validateOptions(options);
  }

  serialize(type, data, schema, extraData, excludeData, overrideSchemaOptions = {}) {
    if (arguments.length === 3) {
      if (typeof schema === 'object') {
        extraData = schema;
        schema = 'default';
      }
    }

    schema = schema || 'default';
    extraData = extraData || {};

    const included = new Map();
    const isDynamicType = typeof type === 'object';
    const options = this._getSchemaOptions(type, schema, overrideSchemaOptions);

    let dataProperty;

    if (excludeData) {
      dataProperty = undefined;
    } else if (isDynamicType) {
      dataProperty = this.serializeMixedResource(
        options,
        data,
        included,
        extraData,
        overrideSchemaOptions
      );
    } else {
      dataProperty = this.serializeResource(
        type,
        data,
        options,
        included,
        extraData,
        overrideSchemaOptions
      );
    }

    return {
      jsonapi: options.jsonapiObject ? { version: '1.0' } : undefined,
      meta: this.processOptionsValues(data, extraData, options.topLevelMeta, 'extraData'),
      links: this.processOptionsValues(data, extraData, options.topLevelLinks, 'extraData'),
      data: dataProperty,
      included: included.size ? [...included.values()] : undefined,
    };
  }

  serializeAsync(type, data, schema, extraData, excludeData, overrideSchemaOptions = {}) {
    if (arguments.length === 3) {
      if (typeof schema === 'object') {
        extraData = schema;
        schema = 'default';
      }
    }

    schema = schema || 'default';
    extraData = extraData || {};

    const included = new Map();
    const isDataArray = Array.isArray(data);
    const isDynamicType = typeof type === 'object';
    const arrayData = isDataArray ? data : [data];
    const serializedData = [];
    const that = this;
    let i = 0;
    const options = this._getSchemaOptions(type, schema, overrideSchemaOptions);

    return new Promise((resolve, reject) => {
      function next() {
        setImmediate(() => {
          if (excludeData) {
            return resolve();
          }
          if (i >= arrayData.length) {
            return resolve(serializedData);
          }

          try {
            const serializedItem = isDynamicType
              ? that.serializeMixedResource(
                  type,
                  arrayData[i],
                  included,
                  extraData,
                  overrideSchemaOptions
                )
              : that.serializeResource(
                  type,
                  arrayData[i],
                  options,
                  included,
                  extraData,
                  overrideSchemaOptions
                );

            if (serializedItem !== null) {
              serializedData.push(serializedItem);
            }

            i += 1;

            return next();
          } catch (e) {
            return reject(e);
          }
        });
      }

      next();
    }).then((result) => {
      let dataProperty;

      if (typeof result === 'undefined') {
        dataProperty = undefined;
      } else if (isDataArray) {
        dataProperty = result;
      } else {
        dataProperty = result[0] || null;
      }

      return {
        jsonapi: options.jsonapiObject ? { version: '1.0' } : undefined,
        meta: this.processOptionsValues(data, extraData, options.topLevelMeta, 'extraData'),
        links: this.processOptionsValues(data, extraData, options.topLevelLinks, 'extraData'),
        data: dataProperty,
        included: included.size ? [...included.values()] : undefined,
      };
    });
  }

  deserialize(type, data, schema) {
    schema = schema || 'default';

    if (typeof type === 'object') {
      type = validateDynamicTypeOptions(type);
    } else {
      if (!this.schemas[type]) {
        throw new Error(`No type registered for ${type}`);
      }

      if (schema && !this.schemas[type][schema]) {
        throw new Error(`No schema ${schema} registered for ${type}`);
      }
    }

    let deserializedData = {};

    if (data.data) {
      deserializedData = Array.isArray(data.data)
        ? data.data.map((resource) =>
            this.deserializeResource(type, resource, schema, data.included)
          )
        : this.deserializeResource(type, data.data, schema, data.included);
    }

    return deserializedData;
  }

  deserializeAsync(type, data, schema) {
    schema = schema || 'default';

    if (typeof type === 'object') {
      type = validateDynamicTypeOptions(type);
    } else {
      if (!this.schemas[type]) {
        throw new Error(`No type registered for ${type}`);
      }

      if (schema && !this.schemas[type][schema]) {
        throw new Error(`No schema ${schema} registered for ${type}`);
      }
    }

    const isDataArray = Array.isArray(data.data);
    let i = 0;
    const arrayData = isDataArray ? data.data : [data.data];
    const deserializedData = [];
    const that = this;

    return new Promise((resolve, reject) => {
      function next() {
        setImmediate(() => {
          if (i >= arrayData.length) {
            return resolve(isDataArray ? deserializedData : deserializedData[0]);
          }

          try {
            const deserializedItem = that.deserializeResource(
              type,
              arrayData[i],
              schema,
              data.included
            );

            deserializedData.push(deserializedItem);

            i += 1;

            return next();
          } catch (e) {
            return reject(e);
          }
        });
      }

      next();
    });
  }

  serializeError(error) {
    return {
      errors: Array.isArray(error)
        ? error.map((err) => validateError(err))
        : [validateError(error)],
    };
  }

  deserializeResource(type, data, schema = 'default', included, lineage = []) {
    if (typeof type === 'object') {
      type = typeof type.type === 'function' ? type.type(data) : get(data, type.type);
    }

    if (!type) {
      throw new Error(`No type can be resolved from data: ${JSON.stringify(data)}`);
    }

    if (!this.schemas[type]) {
      throw new Error(`No type registered for ${type}`);
    }

    const options = this.schemas[type][schema];

    let deserializedData = {};
    if (data.id !== undefined) {
      deserializedData[options.id] = data.id;
    }

    if (data.attributes && options.whitelistOnDeserialize.length) {
      data.attributes = pick(data.attributes, options.whitelistOnDeserialize);
    }

    if (data.attributes && options.blacklistOnDeserialize.length) {
      data.attributes = omit(data.attributes, options.blacklistOnDeserialize);
    }

    Object.assign(deserializedData, data.attributes);

    if (data.relationships) {
      Object.keys(data.relationships).forEach((relationshipProperty) => {
        const relationship = data.relationships[relationshipProperty];
        const relationshipType = this._getRelationshipDataType(relationship.data);

        const relationshipKey = options.unconvertCase
          ? this._convertCase(relationshipProperty, options.unconvertCase)
          : relationshipProperty;

        const relationshipOptions =
          options.relationships[relationshipKey] || this.schemas[relationshipType];

        const deserializeFunction = (relationshipData) => {
          if (relationshipOptions && relationshipOptions.deserialize) {
            return relationshipOptions.deserialize(relationshipData);
          }
          return relationshipData.id;
        };

        if (relationship.data !== undefined) {
          if (relationship.data === null) {
            set(
              deserializedData,
              (relationshipOptions && relationshipOptions.alternativeKey) || relationshipKey,
              null
            );
          } else {
            if ((relationshipOptions && relationshipOptions.alternativeKey) || !included) {
              set(
                deserializedData,
                (relationshipOptions && relationshipOptions.alternativeKey) || relationshipKey,
                Array.isArray(relationship.data)
                  ? relationship.data.map((d) => deserializeFunction(d))
                  : deserializeFunction(relationship.data)
              );
            }

            if (included) {
              const deserializeIncludedRelationship = (relationshipData) => {
                const lineageCopy = [...lineage];
                const lineageKey = `${relationshipData.type}-${relationshipData.id}`;
                const isCircular = lineageCopy.includes(lineageKey);

                if (isCircular) {
                  return deserializeFunction(relationshipData);
                }

                lineageCopy.push(lineageKey);
                return this.deserializeIncluded(
                  relationshipData.type,
                  relationshipData.id,
                  relationshipOptions,
                  included,
                  lineageCopy,
                  deserializeFunction
                );
              };

              const deserializedIncludedRelationship = Array.isArray(relationship.data)
                ? relationship.data.map((d) => deserializeIncludedRelationship(d))
                : deserializeIncludedRelationship(relationship.data);

              if (
                !(
                  relationshipOptions &&
                  relationshipOptions.alternativeKey &&
                  deserializedIncludedRelationship.toString() ===
                    get(deserializedData, relationshipOptions.alternativeKey).toString()
                )
              ) {
                set(deserializedData, relationshipKey, deserializedIncludedRelationship);
              }
            }
          }
        }
      });
    }

    if (options.unconvertCase) {
      deserializedData = this._convertCase(deserializedData, options.unconvertCase);
    }

    if (data.links) {
      deserializedData.links = data.links;
    }

    if (data.meta) {
      deserializedData.meta = data.meta;
    }

    if (options.afterDeserialize) {
      return options.afterDeserialize(deserializedData);
    }

    return deserializedData;
  }

  deserializeIncluded(type, id, relationshipOpts, included, lineage, deserializeFunction) {
    const includedResource = included.find(
      (resource) => resource.type === type && resource.id === id
    );

    if (!includedResource) {
      return deserializeFunction({ type, id });
    }

    if (!relationshipOpts) {
      throw new Error(`No type registered for ${type}`);
    }

    return this.deserializeResource(
      type,
      includedResource,
      relationshipOpts.schema,
      included,
      lineage
    );
  }

  serializeResource(type, data, options, included, extraData, overrideSchemaOptions = {}) {
    if (isEmpty(data)) {
      return Array.isArray(data) ? data : null;
    }

    if (Array.isArray(data)) {
      return data.map((d) =>
        this.serializeResource(type, d, options, included, extraData, overrideSchemaOptions)
      );
    }

    if (options.beforeSerialize) {
      data = options.beforeSerialize(data);
    }

    return {
      type,
      id: data[options.id] ? data[options.id].toString() : undefined,
      attributes: this.serializeAttributes(data, options),
      relationships: this.serializeRelationships(
        data,
        options,
        included,
        extraData,
        overrideSchemaOptions
      ),
      meta: this.processOptionsValues(data, extraData, options.meta),
      links: this.processOptionsValues(data, extraData, options.links),
    };
  }

  serializeMixedResource(typeOption, data, included, extraData, overrideSchemaOptions = {}) {
    if (isEmpty(data)) {
      return Array.isArray(data) ? data : null;
    }

    if (Array.isArray(data)) {
      return data.map((d) =>
        this.serializeMixedResource(typeOption, d, included, extraData, overrideSchemaOptions)
      );
    }

    const type =
      typeof typeOption.type === 'function' ? typeOption.type(data) : get(data, typeOption.type);

    if (!type) {
      throw new Error(`No type can be resolved from data: ${JSON.stringify(data)}`);
    }

    if (!this.schemas[type]) {
      throw new Error(`No type registered for ${type}`);
    }

    const options = this._getSchemaOptions(type, 'default', overrideSchemaOptions);

    return this.serializeResource(type, data, options, included, extraData, overrideSchemaOptions);
  }

  serializeAttributes(data, options) {
    if (options.whitelist && options.whitelist.length) {
      data = pick(data, options.whitelist);
    }

    const alternativeKeys = [];
    Object.keys(options.relationships).forEach((key) => {
      const rOptions = options.relationships[key];
      if (rOptions.alternativeKey) {
        alternativeKeys.push(rOptions.alternativeKey);
      }
    });

    let serializedAttributes = omit(data, [
      options.id,
      ...Object.keys(options.relationships),
      ...alternativeKeys,
      ...options.blacklist,
    ]);

    if (options.convertCase) {
      serializedAttributes = this._convertCase(serializedAttributes, options.convertCase);
    }

    return Object.keys(serializedAttributes).length ? serializedAttributes : undefined;
  }

  serializeRelationships(data, options, included, extraData, overrideSchemaOptions = {}) {
    const serializedRelationships = {};

    Object.keys(options.relationships).forEach((relationship) => {
      const relationshipOptions = options.relationships[relationship];

      let relationshipKey = relationship;
      if (!data[relationship] && relationshipOptions.alternativeKey) {
        relationshipKey = relationshipOptions.alternativeKey;
      }

      const serializeRelationship = {
        links: this.processOptionsValues(data, extraData, relationshipOptions.links),
        meta: this.processOptionsValues(data, extraData, relationshipOptions.meta),
        data: this.serializeRelationship(
          relationshipOptions.type,
          relationshipOptions.schema,
          get(data, relationshipKey),
          included,
          data,
          extraData,
          overrideSchemaOptions
        ),
      };

      if (
        serializeRelationship.data !== undefined ||
        serializeRelationship.links !== undefined ||
        serializeRelationship.meta !== undefined
      ) {
        relationship = options.convertCase
          ? this._convertCase(relationship, options.convertCase)
          : relationship;

        serializedRelationships[relationship] = serializeRelationship;
      }
    });

    return Object.keys(serializedRelationships).length ? serializedRelationships : undefined;
  }

  serializeRelationship(
    rType,
    rSchema,
    rData,
    included,
    data,
    extraData,
    overrideSchemaOptions = {}
  ) {
    included = included || new Map();
    const schema = rSchema || 'default';

    if (rData === undefined || rData === null) {
      return rData;
    }

    if (typeof rData === 'object' && isEmpty(rData)) {
      return Array.isArray(rData) ? [] : null;
    }

    if (Array.isArray(rData)) {
      return rData.map((d) =>
        this.serializeRelationship(
          rType,
          schema,
          d,
          included,
          data,
          extraData,
          overrideSchemaOptions
        )
      );
    }

    const type = typeof rType === 'function' ? rType(rData, data) : rType;

    if (!type) {
      throw new Error(`No type can be resolved from relationship's data: ${JSON.stringify(rData)}`);
    }

    if (!this.schemas[type]) {
      throw new Error(`No type registered for "${type}"`);
    }

    if (!this.schemas[type][schema]) {
      throw new Error(`No schema "${schema}" registered for type "${type}"`);
    }

    let rOptions = this.schemas[type][schema];

    if (overrideSchemaOptions[type]) {
      rOptions = { ...rOptions, ...overrideSchemaOptions[type] };
    }

    const serializedRelationship = { type };

    if (!isObjectLike(rData)) {
      serializedRelationship.id = rData.toString();
    } else {
      const serializedIncluded = this.serializeResource(
        type,
        rData,
        rOptions,
        included,
        extraData,
        overrideSchemaOptions
      );

      serializedRelationship.id = serializedIncluded.id;
      const identifier = `${type}-${serializedRelationship.id}`;

      if (
        (serializedIncluded.attributes && Object.keys(serializedIncluded.attributes).length) ||
        (serializedIncluded.relationships && Object.keys(serializedIncluded.relationships).length)
      ) {
        if (included.has(identifier)) {
          const alreadyIncluded = included.get(identifier);

          if (serializedIncluded.relationships) {
            alreadyIncluded.relationships = {
              ...alreadyIncluded.relationships,
              ...serializedIncluded.relationships,
            };
            included.set(identifier, alreadyIncluded);
          }
        } else {
          included.set(identifier, serializedIncluded);
        }
      }
    }
    return serializedRelationship;
  }

  processOptionsValues(data, extraData, options, fallbackModeIfOneArg) {
    let processedOptions = {};
    if (options && typeof options === 'function') {
      processedOptions =
        fallbackModeIfOneArg === 'extraData' && options.length === 1
          ? options(extraData)
          : options(data, extraData);
    } else {
      Object.keys(options).forEach((key) => {
        let processedValue = {};
        if (options[key] && typeof options[key] === 'function') {
          processedValue =
            fallbackModeIfOneArg === 'extraData' && options[key].length === 1
              ? options[key](extraData)
              : options[key](data, extraData);
        } else {
          processedValue = options[key];
        }
        Object.assign(processedOptions, { [key]: processedValue });
      });
    }

    return processedOptions && Object.keys(processedOptions).length ? processedOptions : undefined;
  }

  _getSchemaOptions(type, schema, overrideSchemaOptions = {}) {
    const isDynamicType = typeof type === 'object';
    const overrideType = isDynamicType ? type.type : type;
    const overrideOptions = { ...(overrideSchemaOptions[overrideType] || {}) };

    if (isDynamicType) {
      return validateDynamicTypeOptions(type);
    }

    if (!this.schemas[type]) {
      throw new Error(`No type registered for ${type}`);
    }

    if (schema && !this.schemas[type][schema]) {
      throw new Error(`No schema ${schema} registered for ${type}`);
    }

    return { ...this.schemas[type][schema], ...overrideOptions };
  }

  _getRelationshipDataType(data) {
    if (data === null || typeof data === 'undefined') {
      return null;
    }

    if (Array.isArray(data)) {
      return get(data[0], 'type');
    }

    return data.type;
  }

  _convertCase(data, convertCaseOptions) {
    if (Array.isArray(data)) {
      return data.map((item) => {
        if (item && (Array.isArray(item) || isPlainObject(item))) {
          return this._convertCase(item, convertCaseOptions);
        }
        return item;
      });
    }

    if (isPlainObject(data)) {
      return transform(
        data,
        (result, value, key) => {
          let converted;
          if (value && (Array.isArray(value) || isPlainObject(value))) {
            converted = this._convertCase(value, convertCaseOptions);
          } else {
            converted = value;
          }

          result[this._convertCase(key, convertCaseOptions)] = converted;
          return result;
        },
        {}
      );
    }

    if (typeof data === 'string') {
      let converted;

      switch (convertCaseOptions) {
        case 'snake_case':
          converted = this.convertCaseMap.snakeCase.get(data);
          if (!converted) {
            converted = toSnakeCase(data);
            this.convertCaseMap.snakeCase.set(data, converted);
          }
          break;
        case 'kebab-case':
          converted = this.convertCaseMap.kebabCase.get(data);
          if (!converted) {
            converted = toKebabCase(data);
            this.convertCaseMap.kebabCase.set(data, converted);
          }
          break;
        case 'camelCase':
          converted = this.convertCaseMap.camelCase.get(data);
          if (!converted) {
            converted = toCamelCase(data);
            this.convertCaseMap.camelCase.set(data, converted);
          }
          break;
        default: 
      }

      return converted;
    }

    return data;
  }
};
