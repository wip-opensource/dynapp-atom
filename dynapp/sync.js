const config = require('./config');
const api = require('./api');
const md5File = require('md5-file/promise');
const fs = require('fs-extra');
const path = require('path');
const mkdirp = require('mkdirp');
const JSZip = require('jszip');

function json_stringify_readable(content) {
  return JSON.stringify(content, null, 4);
}

// Remove dir with files recursively
const rmdir = async function(dir) {
    // TODO: Handle file operations concurrently, but probably is overkill.
    let files = await fs.readdir(dir);

    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      let fileName = path.join(dir, file);
      let stat = fs.statSync(fileName);

      if (fileName == "." || fileName == "..") {
          // pass these files
          continue;
      } else if (stat.isDirectory()) {
          // rmdir recursively
          await rmdir(fileName);
      } else {
          // rm filename
          await fs.unlink(fileName);
      }
    }
    await fs.rmdir(dir);
};

/* TODO: I'm absolutely certain there is a good use case for generators here,
   but i can't figure out how to use them with nested promises.
   Is there a workaround without babel until this is available?
   https://github.com/tc39/proposal-async-iteration
*/
/* TODO: Can be optimized by not simply awaiting everything. Next file could be read in parallel. */
async function listFiles(folder, filter) {
  let result = [];

  let files = await fs.readdir(folder);
  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    let fileWithPath = path.join(folder, file);

    if (filter && !filter(fileWithPath)) {
      continue;
    }
    let stats = await fs.stat(fileWithPath);
    if (stats.isDirectory()) {
      let subFiles = await listFiles(path.join(folder, file), filter);
      subFiles.forEach(subFile => {
        result.push(path.join(file, subFile));
      });
    } else {
      result.push(file);
    }
  }

  return result.slice(0);
}

function filterNoNodeModules(fileName) {
  return fileName.indexOf('node_modules/') === -1;
}

function filterMetaFiles(fileName) {
  return !fileName.endsWith('.meta.json');
}

class DynappObjects {
  constructor(folder, fileExt, filter) {
    this.folder = folder;
    // TODO: This is not good, dirt hacky workaround.
    // Should just use a single meta-file per type (data-items, data-source-items, data-objects)
    this.fileExt = fileExt || '';
    this.filter = filter || (() => true);
  }

  _objectsPath () {
    return path.join(config.workPath(), this.folder);
  }

  async upload () {
    let objectsPath = this._objectsPath();
    let operations = [];
    let [newObjects, changedObjects, deletedObjects] = await this.dirty();

    for (let obj of newObjects) {
      operations.push(this.createObject(obj, path.join(objectsPath, obj)));
    }
    for (let obj of changedObjects) {
      operations.push(this.updateObject(obj, path.join(objectsPath, obj)));
    }
    for (let obj of deletedObjects) {
      operations.push(this.deleteObject(obj).catch(err => {
        // File has been removed by other means, everything is good
        if (err.statusCode && err.statusCode === 404)
          return err.message;
        else
          throw err;
      }));
    }

    return await Promise.all(operations);
  }

  createObject (obj, file) {
    throw new Error('Not implemented');
  }

  updateObject (obj, file) {
    throw new Error('Not implemented');
  }

  deleteObject (obj, file) {
    throw new Error('Not implemented');
  }

  async hashes() {
    let operations = [];
    let objectsPath = this._objectsPath();
    // TODO: Reuse list from dirty() and hashes() ?
    let localFiles = await listFiles(objectsPath, this.filter);

    for (let i = 0; i < localFiles.length; i++) {
      let fileName = localFiles[i];
      let operation = md5File(path.join(objectsPath, fileName)).then(function(hash) {
        return {
          name: fileName,
          hash: hash
        };
      });

      operations.push(operation);
    }

    let files = await Promise.all(operations);
    let result = {};

    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      result[file.name] = {
        hash: file.hash
      };
    }

    return result;
  }

  setHashes (hashes) {
    this._hashes = hashes;
  }

  async readMeta (file) {
    let metaFilePath = file + '.meta.json';
    let metaRaw = '{}'
    try {
      metaRaw = await fs.readFile(metaFilePath, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT')
        throw err;
    }
    return JSON.parse(metaRaw);
  }

  async generateMeta (file) {
    // Generates a meta json file, used for updating data-sources and -objects
    let metaFilePath = file.substring(0, file.lastIndexOf('.py')) + '.meta.json';

    let bodyRaw = await fs.readFile(file, 'utf8');
    let body = Buffer.from(bodyRaw).toString('base64');

    let metaRaw = '{}';
    try {
      metaRaw = await fs.readFile(metaFilePath, 'utf8');
    } catch(err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    let meta = JSON.parse(metaRaw);

    meta.stylesheet = body;
    return json_stringify_readable(meta);
  }

  async dirty() {
    let objectsPath = this._objectsPath();
    let localFiles = await listFiles(objectsPath, this.filter);
    let newObjects = [];
    let deletedObjects = [];
    let changedObjectsOperations = [];

    for (let file of localFiles) {
      if (file in this._hashes) {
        let operation = md5File(path.join(objectsPath, file)).then((hash) => {
          return this._hashes[file].hash !== hash ? file : null;
        });
        changedObjectsOperations.push(operation);
      } else if (!file.endsWith('.meta.json')) {
        newObjects.push(file);
      }
    }

    for (let fileName in this._hashes) {
      if (localFiles.indexOf(fileName) === -1) {
        deletedObjects.push(fileName);
      }
    }

    // Remove all nulls returned in above loop
    let changedObjects = (await Promise.all(changedObjectsOperations))
      .filter(item => !!item);
    changedObjects = changedObjects.map(item => item.replace(/\.meta\.json$/, this.fileExt));
    // Remove duplicates. We might have caught meta files that we formatted to be origin files.
    // Because if meta changes origin should be updated.
    changedObjects = [...new Set(changedObjects)];

    return [newObjects, changedObjects, deletedObjects];
  }
}

class DataItems extends DynappObjects {
  constructor() {
    super('data-items', null, filterNoNodeModules);
  }

  async createObject (dataItem, file) {
    // TODO: Should we use PUT? Then we have to catch eventual error and try PUT if POST already exists.
    // Seems like PUT just overrides everything, and that is kind of what we want.
    return await api.updateDataItem(dataItem, fs.createReadStream(file), await this.readMeta(file));
  }

  async updateObject (dataItem, file) {
    return await api.updateDataItem(dataItem, fs.createReadStream(file), await this.readMeta(file));
  }

  deleteObject (dataItem) {
    return api.deleteDataItem(dataItem);
  }
}

class DataSourceItems extends DynappObjects {
  constructor() {
    super('data-source-items', '.py');
  }

  async createObject (dataSourceItem, file) {
    return await api.updateDataSourceItem(dataSourceItem.substring(0, dataSourceItem.lastIndexOf('.py')), await this.generateMeta(file));
  }

  async updateObject (dataSourceItem, file) {
    return await api.updateDataSourceItem(dataSourceItem.substring(0, dataSourceItem.lastIndexOf('.py')), await this.generateMeta(file));
  }

  deleteObject (dataSourceItem) {
    return api.deleteDataSourceItem(dataSourceItem);
  }
}

class DataObjects extends DynappObjects {
  constructor() {
    super('data-objects', '.py');
  }

  async createObject (dataObject, file) {
    return await api.updateDataObject(dataObject.substring(0, dataObject.lastIndexOf('.py')), await this.generateMeta(file));
  }

  async updateObject (dataObject, file) {
    return await api.updateDataObject(dataObject.substring(0, dataObject.lastIndexOf('.py')), await this.generateMeta(file));
  }

  deleteObject (dataObject) {
    return api.deleteDataObject(dataObject);
  }
}

class Sync {
  constructor () {
    this.dataItems = new DataItems();
    this.dataSourceItems = new DataSourceItems();
    this.dataObjects = new DataObjects();
  }

  getStateFilePath () {
    return config.workFilePath('.dynapp-state');
  }

  async state () {
    let stateContent;

    try {
      stateContent = await fs.readFile(this.getStateFilePath(), 'utf8');
    } catch(err) {
      // Ensure we have a state-file
      if (err.code === 'ENOENT') {
        stateContent = json_stringify_readable({});
        await fs.writeFile(this.getStateFilePath(), stateContent, 'utf8');
      } else {
        throw err;
      }
    }

    return JSON.parse(stateContent);
  }

  async setHashes () {
    let state = await this.state();
    this.dataItems.setHashes(state['data-items'] || {});
    this.dataSourceItems.setHashes(state['data-source-items'] || {});
    this.dataObjects.setHashes(state['data-objects'] || {});
  }

  async dumpState () {
    let hashes = await Promise.all([
      this.dataItems.hashes(),
      this.dataSourceItems.hashes(),
      this.dataObjects.hashes()
    ]);

    let state = {
      'data-items': hashes[0],
      'data-source-items': hashes[1],
      'data-objects': hashes[2]
    };
    return await fs.writeFile(this.getStateFilePath(), json_stringify_readable(state), 'utf8');
  }

  async upload () {
    await this.setHashes();

    await Promise.all([
      this.dataItems.upload(),
      this.dataSourceItems.upload(),
      this.dataObjects.upload()
    ]);

    await this.dumpState();
  }

  async download () {
    // TODO: Break into parts and put in respective class

    // TODO: Now we load all of the zip into memory.
    // Can we stream it somehow?
    const appZip = await api.downloadApp();
    const unpacked = await JSZip.loadAsync(appZip);
    const workpath = config.workPath();

    // TODO: Do in parallel? Probably overkill though
    await rmdir(path.join(workpath, 'data-items'));
    await rmdir(path.join(workpath, 'data-source-items'));
    await rmdir(path.join(workpath, 'data-objects'));
    // TODO: Do in parallel? Probably overkill though
    await fs.mkdir(path.join(workpath, 'data-items'));
    await fs.mkdir(path.join(workpath, 'data-source-items'));
    await fs.mkdir(path.join(workpath, 'data-objects'));

    let operations = [];
    let dataItemsMeta = await unpacked.file('data-items.json').async('text');
    dataItemsMeta = JSON.parse(dataItemsMeta);

    for (let fileName in unpacked.files) {
      if (!fileName.startsWith('data-items/')) {
        continue;
      }

      let file = unpacked.file(fileName);
      let dataItemFileCreation = new Promise(function(resolve, reject) {
        let localFileName = path.join(workpath, fileName);
        mkdirp(path.dirname(localFileName), function() {
          file.nodeStream()
            .pipe(fs.createWriteStream(localFileName))
            .on('finish', function() {
              resolve();
            });
        });
      }).then(function() {
        let currentFileKey = fileName.substring('data-items/'.length);
        let currentFileMeta = dataItemsMeta.find(m => m.name === currentFileKey);
        let metaContent = {
          category: currentFileMeta.category
        };
        if (currentFileMeta.contentType)
          metaContent.contentType = currentFileMeta.contentType;
        if (currentFileMeta.key)
          metaContent.key = currentFileMeta.key;

        return fs.writeFile(path.join(workpath, fileName + '.meta.json'), JSON.stringify(metaContent));
      });

      operations.push(dataItemFileCreation);
    }

    if ('data-objects.json' in unpacked.files) {
      operations.push(new Promise(function(resolve, reject) {
        unpacked.file('data-objects.json').async('text').then(function(dataObjectsRaw) {
          let dataObjects = JSON.parse(dataObjectsRaw);
          let dataObjectOperations = [];

          for (let dataObject of dataObjects) {
            let code;
            if (dataObject.stylesheet) {
              code = Buffer.from(dataObject.stylesheet, 'base64').toString('utf8');
            } else {
              code = '';
            }
            dataObject.stylesheet = '<See corresponding .py file>';
            let pyName = dataObject.name + '.py';
            let metaName = dataObject.name + '.meta.json';
            let pyOperation = fs.writeFile(path.join(workpath, 'data-objects', pyName), code);
            let metaOperation = fs.writeFile(path.join(workpath, 'data-objects', metaName), json_stringify_readable(dataObject));

            dataObjectOperations.push(pyOperation, metaOperation);
          }

          Promise.all(dataObjectOperations).then(resolve);
        });
      }));
    }

    // TODO: Duplicated code form data-objects
    if ('data-source-items.json' in unpacked.files) {
      operations.push(new Promise(function(resolve, reject) {
        unpacked.file('data-source-items.json').async('text').then(function(dataSourceItemsRaw) {
          let dataSourceItems = JSON.parse(dataSourceItemsRaw);
          let dataSourceItemOperations = [];

          for (let dataSourceItem of dataSourceItems) {
            let code;
            if (dataSourceItem.stylesheet) {
              code = Buffer.from(dataSourceItem.stylesheet, 'base64').toString('utf8');
            }
            else {
              code = '';
            }
            dataSourceItem.stylesheet = '<See corresponding .py file>';
            let pyName = dataSourceItem.name + '.py';
            let metaName = dataSourceItem.name + '.meta.json';

            let pyOperation = fs.writeFile(path.join(workpath, 'data-source-items', pyName), code);
            let metaOperation = fs.writeFile(path.join(workpath, 'data-source-items', metaName), json_stringify_readable(dataSourceItem));

            dataSourceItemOperations.push(pyOperation, metaOperation);
          }

          Promise.all(dataSourceItemOperations).then(resolve);
        });
      }));
    }

    await Promise.all(operations);
    await this.dumpState();
  }
}

// TODO: Defer instantiation to the caller instead.
module.exports = {
  Sync: Sync
}
