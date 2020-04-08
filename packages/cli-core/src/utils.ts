// Copyright IBM Corp. 2017,2020. All Rights Reserved.
// Node module: @loopback/cli
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {JSONObject} from '@loopback/core';
import chalk from 'chalk';
import {pascalCase} from 'change-case';
import fs from 'fs';
import inquirer from 'inquirer';
import _, {camelCase, kebabCase, template} from 'lodash';
import path from 'path';
import readline from 'readline';
import semver from 'semver';
import stream from 'stream';
import _stringifyObject from 'stringify-object';
import util, {promisify} from 'util';
import validateNpmPackageName from 'validate-npm-package-name';
import {debug as debugFactory} from './debug';
import {Logger} from './types';

const regenerate = require('regenerate');
export const urlSlug = require('url-slug');
const Conflicter = require('yeoman-generator/lib/util/conflicter');

const connectors: JSONObject = require('./connectors.json');
const debug = debugFactory('utils');
const readdirAsync = promisify(fs.readdir);

export {camelCase as toVarName, pascalCase} from 'change-case';
export {camelCase} from 'lodash';
export * as pluralize from 'pluralize';
export * as tildify from 'tildify';
export * as untildify from 'untildify';

export const toFileName = (name: string) => {
  return kebabCase(name).replace(/\-(\d+)$/g, '$1');
};

const RESERVED_PROPERTY_NAMES = ['constructor'];

/**
 * Returns a valid variable name regex;
 * taken from https://gist.github.com/mathiasbynens/6334847
 */
function generateValidRegex() {
  const get = function (what: string) {
    return require('unicode-10.0.0/' + what + '/code-points.js');
  };
  const idStart = get('Binary_Property/ID_Start');
  const idContinue = get('Binary_Property/ID_Continue');
  const compileRegex = template(
    '^(?:<%= identifierStart %>)(?:<%= identifierPart %>)*$',
  );
  const identifierStart = regenerate(idStart).add('$', '_');
  const identifierPart = regenerate(idContinue).add(
    '$',
    '_',
    '\u200C',
    '\u200D',
  );
  const regex = compileRegex({
    identifierStart: identifierStart.toString(),
    identifierPart: identifierPart.toString(),
  });
  return new RegExp(regex);
}

export const validRegex = generateValidRegex();

/**
 * validate application (module) name
 * @param name
 * @returns {String|Boolean}
 */
export function validateClassName(name?: string) {
  if (!name || name === '') {
    return 'Class name cannot be empty';
  }
  if (name.match(validRegex)) {
    return true;
  }
  if (name.match(/^\d/)) {
    return util.format('Class name cannot start with a number: %s', name);
  }
  if (name.includes('.')) {
    return util.format('Class name cannot contain .: %s', name);
  }
  if (name.includes(' ')) {
    return util.format('Class name cannot contain spaces: %s', name);
  }
  if (name.includes('-')) {
    return util.format('Class name cannot contain hyphens: %s', name);
  }
  if (name.match(/[\/@\s\+%:]/)) {
    return util.format(
      'Class name cannot contain special characters (/@+%: ): %s',
      name,
    );
  }
  return util.format('Class name is invalid: %s', name);
}

export function logNamingIssues(name: string, log: Logger) {
  if (name.includes('_')) {
    log(
      chalk.red('>>> ') +
        `Underscores _ in the class name will get removed: ${name}`,
    );
  }
  if (name.match(/[\u00C0-\u024F\u1E00-\u1EFF]/)) {
    log(
      chalk.red('>>> ') +
        `Accented chars in the class name will get replaced: ${name}`,
    );
  }
}

export function logClassCreation(
  type: string,
  typePlural: string,
  name: string,
  log: Logger,
) {
  log(
    `${toClassName(type)} ${chalk.yellow(
      name,
    )} will be created in src/${typePlural}/${chalk.yellow(
      toFileName(name) + '.' + `${type}.ts`,
    )}`,
  );
  log();
}

/**
 * Validate project directory to not exist
 */
export function validateNotExisting(projDir: string) {
  if (fs.existsSync(projDir)) {
    return util.format('Directory %s already exists.', projDir);
  }
  return true;
}

/**
 * validate source key or foreign key for relations
 */
/* istanbul ignore next */
export function validateKeyName(name: string) {
  if (!name || name === '') {
    return 'Key name cannot be empty';
  }
  if (name.match(/^\d/)) {
    return util.format('Key name cannot start with a number: %s', name);
  }
  if (name.includes('.')) {
    return util.format('Key name cannot contain .: %s', name);
  }
  if (name.includes(' ')) {
    return util.format('Key name cannot contain spaces: %s', name);
  }
  if (name.includes('-')) {
    return util.format('Key name cannot contain hyphens: %s', name);
  }
  if (name.match(/[\/@\s\+%:]/)) {
    return util.format(
      'Key name cannot contain special characters (/@+%: ): %s',
      name,
    );
  }
  return true;
}

/**
 * checks if the belongsTo relation has the same relation name and source key name,
 * which is an invalid case.
 */
/* istanbul ignore next */
export function validateRelationName(
  name: string,
  type: string,
  foreignKeyName: string,
) {
  if (!name || name === '') {
    return 'Relation name cannot be empty';
  }
  if (type === 'belongsTo' && name === foreignKeyName) {
    return util.format(
      'Relation name cannot be the same as the source key name: %s',
      name,
    );
  }
  if (name.match(/^\d/)) {
    return util.format('Relation name cannot start with a number: %s', name);
  }
  if (name.includes('.')) {
    return util.format('Relation name cannot contain .: %s', name);
  }
  if (name.includes(' ')) {
    return util.format('Relation name cannot contain spaces: %s', name);
  }
  if (name.includes('-')) {
    return util.format('Relation name cannot contain hyphens: %s', name);
  }
  if (name.match(/[\/@\s\+%:]/)) {
    return util.format(
      'Relation name cannot contain special characters (/@+%: ): %s',
      name,
    );
  }
  return true;
}

/**
 * Converts a name to class name after validation
 */
export function toClassName(name?: string) {
  if (name == null || name === '') throw new Error('no input');
  if (typeof name != 'string' || name == null) throw new Error('bad input');
  return pascalCase(camelCase(name));
}

export function validate(name: string) {
  const isValid = validateNpmPackageName(name).validForNewPackages;
  if (!isValid) return 'Invalid npm package name: ' + name;
  return isValid;
}

/**
 * Adds a backslash to the start of the word if not already present
 * @param {string} httpPath
 */
export const prependBackslash = (httpPath: string) =>
  httpPath.replace(/^\/?/, '/');

/**
 * Validates whether a given string is a valid url slug or not.
 * Allows slugs with backslash in front of them to be validated as well
 * @param {string} name Slug to validate
 */
export function validateUrlSlug(name: string) {
  const backslashIfNeeded = name.charAt(0) === '/' ? '/' : '';
  if (backslashIfNeeded === '/') {
    name = name.substr(1);
  }
  const separators = ['-', '.', '_', '~', ''];
  const possibleSlugs = separators.map(separator =>
    urlSlug(name, separator, false),
  );
  if (!possibleSlugs.includes(name))
    return `Invalid url slug. Suggested slug: ${backslashIfNeeded}${possibleSlugs[0]}`;
  return true;
}

/**
 * Extends conflicter so that it keeps track of conflict status
 */
export class StatusConflicter extends Conflicter {
  constructor(
    adapter: {
      promptModule: inquirer.PromptModule;
    },
    force: boolean,
  ) {
    super(adapter, force);
    this.generationStatus = {}; // keeps track of file conflict history
  }

  checkForCollision(
    filepath: string,
    contents: unknown,
    callback: (err: unknown, status: unknown) => void,
  ) {
    super.checkForCollision(
      filepath,
      contents,
      (err: unknown, status: unknown) => {
        const filename = filepath.split('/').pop();
        this.generationStatus[filename!] = status;
        callback(err, status);
      },
    );
  }
}

/**
 * Find all artifacts in the given path whose type matches the provided
 * filetype.
 * For example, a fileType of "model" will search the target path for matches to
 * "*.model.js"
 * @param {string} path The directory path to search. This search is *not*
 * recursive.
 * @param {string} artifactType The type of the artifact in string form.
 * @param {Function=} reader An optional reader function to retrieve the
 * paths. Must return a Promise.
 * @returns {Promise<string[]>} The filtered list of paths.
 */
export async function findArtifactPaths(
  dir: string,
  artifactType: string,
  reader = readdirAsync,
) {
  const readdir = reader;
  debug(`Finding artifact paths at: ${dir}`);

  try {
    // Wrapping readdir in case it's not a promise.
    const files = await readdir(dir);
    return files.filter(
      f =>
        _.endsWith(f, `${artifactType}.js`) ||
        _.endsWith(f, `${artifactType}.ts`),
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Target directory was not found (e.g. "src/models" does not exist yet).
      return [];
    }
    throw err;
  }
}
/**
 * Parses the files of the target directory and returns matching JavaScript
 * or TypeScript artifact files. NOTE: This function does not examine the
 * contents of these files!
 * @param {string} dir The target directory from which to load artifacts.
 * @param {string} artifactType The artifact type (ex. "model", "repository")
 * @param {boolean} addSuffix Whether or not to append the artifact type to the
 * results. (ex. [Foo,Bar] -> [FooRepository, BarRepository])
 * @param {Function} reader An alternate function to replace the promisified
 * fs.readdir (useful for testing and for custom overrides).
 */
export async function getArtifactList(
  dir: string,
  artifactType: string,
  addSuffix: boolean,
  reader = readdirAsync,
) {
  const paths = await findArtifactPaths(dir, artifactType, reader);
  debug(`Filtering artifact paths: ${paths}`);
  return paths.map(p => {
    const firstWord = _.first(_.split(_.last(_.split(p, path.sep))!, '.'));
    const result = pascalCase(toClassName(firstWord));
    return addSuffix
      ? toClassName(result) + toClassName(artifactType)
      : toClassName(result);
  });
}

/**
 * Check package.json and dependencies.json to find out versions for generated
 * dependencies
 */
export function getDependencies() {
  const pkg = require('../package.json');
  let version = pkg.version;
  // First look for config.loopbackVersion
  if (pkg.config && pkg.config.loopbackVersion) {
    version = pkg.config.loopbackVersion;
  }
  // Set it to be `^x.y.0`
  const loopbackVersion =
    '^' + semver.major(version) + '.' + semver.minor(version) + '.0';

  const deps: Record<string, string> = {};
  const dependencies = (pkg.config && pkg.config.templateDependencies) || {};
  for (const i in dependencies) {
    // Default to loopback version if the version for a given dependency is ""
    deps[i] = dependencies[i] || loopbackVersion;
  }
  return deps;
}

/**
 * Rename EJS files
 */
export function renameEJS() {
  const renameStream = new stream.Transform({objectMode: true});

  renameStream._transform = function (file, enc, callback) {
    const filePath = file.relative;
    const dirname = path.dirname(filePath);
    let extname = path.extname(filePath);
    let basename = path.basename(filePath, extname);

    // extname already contains a leading '.'
    const fileName = `${basename}${extname}`;
    const result = fileName.match(/(.+)(.ts|.json|.js|.md|.html)\.ejs$/);
    if (result) {
      extname = result[2];
      basename = result[1];
      file.path = path.join(file.base, dirname, basename + extname);
    }
    callback(undefined, file);
  };

  return renameStream;
}

/**
 * Get a validate function for object/array type
 * @param {String} type 'object' OR 'array'
 */
export function validateStringObject(type: string) {
  return function validateStringified(val: unknown) {
    if (val === null || val === '') {
      return true;
    }

    const err = `The value must be a stringified ${type}`;

    if (typeof val !== 'string') {
      return err;
    }

    try {
      const result = JSON.parse(val);
      if (type === 'array' && !Array.isArray(result)) {
        return err;
      }
    } catch (e) {
      return err;
    }

    return true;
  };
}

/**
 * Use readline to read text from stdin
 */
export function readTextFromStdin() {
  const rl = readline.createInterface({
    input: process.stdin,
  });

  const lines: string[] = [];
  let err: unknown;
  return new Promise<string>((resolve, reject) => {
    rl.on('SIGINT', () => {
      err = new Error('Canceled by user');
      rl.close();
    })
      .on('line', line => {
        if (line === 'EOF') {
          rl.close();
        } else {
          lines.push(line);
        }
      })
      .on('close', () => {
        if (err) reject(err);
        else resolve(lines.join('\n'));
      })
      .on('error', e => {
        err = e;
        rl.close();
      });
  });
}

/*
 * Validate property name
 * @param {String} name The user input
 * @returns {String|Boolean}
 */
export function checkPropertyName(name: string) {
  const result = validateRequiredName(name);
  if (result !== true) return result;
  if (RESERVED_PROPERTY_NAMES.includes(name)) {
    return `${name} is a reserved keyword. Please use another name`;
  }
  return true;
}

/**
 * Validate required name for properties, data sources, or connectors
 * Empty name could not pass
 * @param {String} name The user input
 * @returns {String|Boolean}
 */
export function validateRequiredName(name: string) {
  if (!name) {
    return 'Name is required';
  }
  return validateValue(name, /[\/@\s\+%:\.]/);
}

function validateValue(name: string, unallowedCharacters = /[\/@\s\+%:\.]/) {
  if (name.match(unallowedCharacters)) {
    return `Name cannot contain special characters ${unallowedCharacters}: ${name}`;
  }
  if (name !== encodeURIComponent(name)) {
    return `Name cannot contain special characters escaped by encodeURIComponent: ${name}`;
  }
  return true;
}
/**
 *  Returns the modelName in the directory file format for the model
 * @param {string} modelName
 */
export function getModelFileName(modelName: string) {
  return `${toFileName(modelName)}.model.ts`;
}

/**
 * Returns the repositoryName in the directory file format for the repository
 * @param {string} repositoryName
 */
export function getRepositoryFileName(repositoryName: string) {
  return `${toFileName(repositoryName)}.repository.ts`;
}

/**
 * Returns the rest-config in the directory file format for the model endpoint
 * @param {string} modelName
 */
export function getRestConfigFileName(modelName: string) {
  return `${toFileName(modelName)}.rest-config.ts`;
}

/**
 * Returns the serviceName in the directory file format for the service
 * @param {string} serviceName
 */
export function getServiceFileName(serviceName: string) {
  return `${toFileName(serviceName)}.service.ts`;
}

/**
 * Returns the observerName in the directory file format for the observer
 * @param {string} observerName
 */
export function getObserverFileName(observerName: string) {
  return `${toFileName(observerName)}.observer.ts`;
}

/**
 * Returns the interceptorName in the directory file format for the interceptor
 * @param {string} interceptorName
 */
export function getInterceptorFileName(interceptorName: string) {
  return `${toFileName(interceptorName)}.interceptor.ts`;
}

/**
 *
 * Returns the connector property for the datasource file
 * @param {string} datasourcesDir path for sources
 * @param {string} dataSourceClass class name for the datasoure
 */
export function getDataSourceConnectorName(
  datasourcesDir: string,
  dataSourceClass: string,
) {
  if (!dataSourceClass) {
    return false;
  }
  let result;
  let jsonFileContent;

  const datasourceJSONFile = path.join(
    datasourcesDir,
    dataSourceToJSONFileName(dataSourceClass),
  );

  debug(`reading ${datasourceJSONFile}`);
  try {
    jsonFileContent = JSON.parse(fs.readFileSync(datasourceJSONFile, 'utf8'));
  } catch (err) {
    debug(`Error reading file ${datasourceJSONFile}: ${err.message}`);
    err.message = `Cannot load ${datasourceJSONFile}: ${err.message}`;
    throw err;
  }

  if (jsonFileContent.connector) {
    result = jsonFileContent.connector;
  }
  return result;
}

/**
 *
 * load the connectors available and check if the basedModel matches any
 * connectorType supplied for the given connector name
 * @param {string} connectorType single or a comma separated string array
 * @param {string} datasourcesDir path for sources
 * @param {string} dataSourceClass class name for the datasoure
 */
export function isConnectorOfType(
  connectorType: string,
  datasourcesDir: string,
  dataSourceClass: string,
) {
  debug(`calling isConnectorType ${connectorType}`);
  let jsonFileContent: Record<string, unknown> = {};

  if (!dataSourceClass) {
    return false;
  }

  const datasourceJSONFile = path.join(
    datasourcesDir,
    dataSourceToJSONFileName(dataSourceClass),
  );

  debug(`reading ${datasourceJSONFile}`);
  try {
    jsonFileContent = JSON.parse(fs.readFileSync(datasourceJSONFile, 'utf8'));
  } catch (err) {
    debug(`Error reading file ${datasourceJSONFile}: ${err.message}`);
    err.message = `Cannot load  ${datasourceJSONFile}: ${err.message}`;
    throw err;
  }

  for (const val of Object.values(connectors)) {
    const connector = val as JSONObject;
    const matchedConnector =
      jsonFileContent.connector === connector.name ||
      jsonFileContent.connector === `loopback-connector-${connector.name}`;

    if (matchedConnector)
      return connectorType.includes(connector.baseModel as string);
  }

  // Maybe for other connectors that are not in the supported list
  return null;
}

/**
 *
 * returns the name property inside the datasource json file
 * @param {string} datasourcesDir path for sources
 * @param {string} dataSourceClass class name for the datasoure
 */
export function getDataSourceName(
  datasourcesDir: string,
  dataSourceClass: string,
) {
  if (!dataSourceClass) {
    return false;
  }
  let result;
  let jsonFileContent;

  const datasourceJSONFile = path.join(
    datasourcesDir,
    dataSourceToJSONFileName(dataSourceClass),
  );

  debug(`reading ${datasourceJSONFile}`);
  try {
    jsonFileContent = JSON.parse(fs.readFileSync(datasourceJSONFile, 'utf8'));
  } catch (err) {
    debug(`Error reading file ${datasourceJSONFile}: ${err.message}`);
    err.message = `Cannot load ${datasourceJSONFile}: ${err.message}`;
    throw err;
  }

  if (jsonFileContent.name) {
    result = jsonFileContent.name;
  }
  return result;
}

export function dataSourceToJSONFileName(dataSourceClass: string) {
  return path.join(
    toFileName(dataSourceClass.replace('Datasource', '')) +
      '.datasource.config.json',
  );
}

export function stringifyObject(data: object, options = {}) {
  return _stringifyObject(data, {
    indent: '  ', // two spaces
    singleQuotes: true,
    inlineCharacterLimit: 80,
    ...options,
  });
}

export function stringifyModelSettings(modelSettings: object) {
  if (!modelSettings || !Object.keys(modelSettings).length) return '';
  return stringifyObject({settings: modelSettings});
}

// literal strings with artifacts directory locations
export const repositoriesDir = 'repositories';
export const datasourcesDir = 'datasources';
export const servicesDir = 'services';
export const modelsDir = 'models';
export const observersDir = 'observers';
export const interceptorsDir = 'interceptors';
export const modelEndpointsDir = 'model-endpoints';
export const sourceRootDir = 'src';