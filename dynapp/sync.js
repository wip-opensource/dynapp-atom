const config = require('./config');
const api = require('./api');
const md5File = require('md5-file/promise');
const fs = require('fs-extra');
const path = require('path');
const mkdirp = require('mkdirp');
const JSZip = require('jszip');

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
          // rm fiilename
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
    if (filter && !filter(file)) {
      continue;
    }
    let stats = await fs.stat(path.join(folder, file));
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
  return fileName.endsWith('.meta.json');
}

class DynappObjects {
  constructor(folder, filter) {
    this.folder = folder;
    this.filter = filter;
  }

  _objectsPath () {
    return path.join(config.projectPath(), this.folder);
  }

  async upload () {
    let objectsPath = this._objectsPath();
    let operations = [];
    let [newObjects, changedObjects, deletedObjects] = await this.dirty();

    for (let obj of newObjects) {
      let file = fs.createReadStream(path.join(objectsPath, obj));
      operations.push(this.createObject(obj, file));
    }
    for (obj of changedObjects) {
      let file = fs.createReadStream(path.join(objectsPath, obj));
      operations.push(this.updateObject(obj, file));
    }
    for (obj of deletedObjects) {
      operations.push(this.deleteObject(obj));
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

  async updateMeta (metaFile) {
    let pyFile = metaFile.substring(0, metaFile.lastIndexOf('.meta.json')) + '.py';
    let metaFilePath = path.join(this._objectsPath(), metaFile);

    let bodyRaw = await fs.readFile(path.join(this._objectsPath(), pyFile), 'utf8');
    let body = new Buffer(bodyRaw).toString('base64');

    let metaRaw = await fs.readFile(metaFilePath, 'utf8');
    let meta = JSON.parse(metaRaw);

    meta.stylesheet = body;
    await fs.writeFile(metaFilePath, JSON.stringify(meta), 'utf8');
  }

  async dirty() {
    let objectsPath = this.objectsPath();
    // TODO: Reuse list from dirty() and hashes() ?
    let localFiles = await listFiles(objectsPath, this.filter);
    let newObjects = [];
    let deletedObjects = [];
    let changedObjectsOperations = [];

    for (let file of localFiles) {
      if (file in this.hashes) {
        let operation = md5File(path.join(objectsPath, file)).then(function(hash) {
          return this.hashes[file].hash !== hash ? file : null;
        });
        changedObjectsOperations.push(operation);
      } else {
        newObjects.push(file);
      }
    }

    for (dataItem in dataItems) {
      if (localFiles.indexOf(dataItem) === -1) {
        deletedObjects.push(dataItem);
      }
    }

    // Remove all nulls returned in above loop
    let changedObjects = (await Promise.all(changedObjectsOperations))
      .filter(item => !!item);

    return [newObjects, changedObjects, deletedObjects];
  }
}

class DataItems extends DynappObjects {
  constructor() {
    super('data-items', filterNoNodeModules);
  }

  createObject (obj, file) {
    return api.createDataItem(obj, file);
  }

  updateObject (obj, file) {
    return api.updateDataItem(obj, file);
  }

  deleteObject (obj) {
    return api.deleteDataItem(obj);
  }
}

class DataSourceItems extends DynappObjects {
  constructor() {
    super('data-source-items', filterMetaFiles);
  }

  createObject (obj, file) {
    return api.createDataSourceItem(obj, file);
  }

  updateObject (obj, file) {
    return api.updateDataSourceItem(obj, file);
  }

  deleteObject (obj) {
    return api.deleteDataSourceItem(obj);
  }
}

class DataObjects extends DynappObjects {
  constructor() {
    super('data-objects', filterMetaFiles);
  }

  async createObject (obj, file) {
    await this.updateMeta();
    return await api.createDataObject(obj, file);
  }

  async updateObject (obj, file) {
    await this.updateMeta();
    return await api.updateDataObject(obj, file);
  }

  async deleteObject (obj) {
    await this.updateMeta();
    return await api.deleteDataObject(obj);
  }
}

class Sync {
  constructor () {
    this._stateFileName = path.join(config.projectPath(), '.dynapp-state');
    this.dataItems = new DataItems();
    this.dataSourceItems = new DataSourceItems();
    this.dataObjects = new DataObjects();
  }

  async state () {
    let stateContent = await fs.readFile(this._stateFileName, 'utf8');
    return JSON.parse(stateContent);
  }

  async setHashes () {
    let state = await this.state();
    this.dataItems.hashes = state['data-items'] || {};
    this.dataSourceItems.hashes = state['data-source-items'] || {};
    this.dataObjects.hashes = state['data-objects'] || {};
  }

  async dumpState () {
    let hashes = await Promise.all([
      this.dataItems.hashes(),
      this.dataSourceItems.hashes(),
      this.dataObjects.hashes()
    ]);

    let state = Object.assign.apply(Object, [{}].concat(hashes));
    return await fs.writeFile(this._stateFileName, JSON.stringify(state), 'utf8');
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
    const projectPath = config.projectPath();

    // TODO: Do in parallel? Probably overkill though
    await rmdir(path.join(projectPath, 'data-items'));
    await rmdir(path.join(projectPath, 'data-source-items'));
    await rmdir(path.join(projectPath, 'data-objects'));
    // TODO: Do in parallel? Probably overkill though
    await fs.mkdir(path.join(projectPath, 'data-items'));
    await fs.mkdir(path.join(projectPath, 'data-source-items'));
    await fs.mkdir(path.join(projectPath, 'data-objects'));

    let operations = [];
    for (let fileName in unpacked.files) {
      if (!fileName.startsWith('data-items/')) {
        continue;
      }

      let file = unpacked.file(fileName);

      operations.push(new Promise(function(resolve, reject) {
        let localFileName = path.join(projectPath, fileName);
        mkdirp(path.dirname(localFileName), function() {
          file.nodeStream()
            .pipe(fs.createWriteStream(localFileName))
            .on('finish', function() {
              resolve();
            });
        });
      }));
    }

    if ('data-objects.json' in unpacked.files) {
      operations.push(new Promise(function(resolve, reject) {
        unpacked.file('data-objects.json').async('text').then(function(dataObjectsRaw) {
          let dataObjects = JSON.parse(dataObjectsRaw);
          let dataObjectOperations = [];

          for (let dataObject of dataObjects) {
            let code = new Buffer(dataObject.stylesheet, 'base64').toString('utf8');
            let pyName = dataObject.name + '.py';
            let metaName = dataObject.name + '.meta.json';
            let pyOperation = fs.writeFile(path.join(projectPath, 'data-objects', pyName), code);
            let metaOperation = fs.writeFile(path.join(projectPath, 'data-objects', metaName), JSON.stringify(dataObject));

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

          for (dataSourceItem of dataSourceItems) {
            let code = new Buffer(dataSourceItem.stylesheet, 'base64').toString('utf8');
            let pyName = '{}.py'.format(dataSourceItem.name);
            let metaName = '{}.meta.json'.format(dataSourceItem.name);

            let pyOperation = fs.writeFile(path.join(projectPath, 'data-source-items', pyName), code);
            let metaOperation = fs.writeFile(path.join(projectPath, 'data-source-items', metaName), JSON.stringify(dataSourceItem));

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

module.exports = new Sync();
