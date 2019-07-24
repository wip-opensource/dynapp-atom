const { CompositeDisposable } = require('atom');
const request = require('request');
const fs = require('fs-extra');
const path = require('path');
const InputDialog = require('../InputDialog.js');
const sync = require('../dynapp/sync');
const config = require('../dynapp/config');

module.exports = {
  subscriptions: null,
  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'dynapp-atom:download': () => this.download(),
      'dynapp-atom:createConfig': () => this.createConfig(),
      'dynapp-atom:createIgnore': () => this.createIgnore(true),
      'dynapp-atom:upload': () => this.upload(),
      'dynapp-atom:newDataObject': () => this.newDataObject(),
      'dynapp-atom:newDataSourceItem': () => this.newDataSourceItem()
    }));
    this.sync = new sync.Sync();
  },
  // TODO: Very similar to newDataObject
  // Could probably be a method of DataSourceItem class
  newDataSourceItem() {
    let dialog = new InputDialog({
      labelText: 'Filename',
      async callback (fileName) {
        let projectPath = config.projectPath();
        let python = `#!/usr/bin/env python
import json

def transform(logger, item, username, password, parameterMap):
    response = {}
    return 200, json.dumps(response)

`
        let meta = {
          'name': fileName,
          'stylesheet': '<See corresponding .py file>',
          'dataSourceUri': '',
          'cacheSeconds': 0,
          'jtidy': false,
          'category': 2,
          'key': '',
          'cron': false
        }
        await Promise.all([
          fs.writeFile(path.join(projectPath, 'data-source-items', fileName + '.meta.json'), JSON.stringify(meta, null, 4), 'utf8'),
          fs.writeFile(path.join(projectPath, 'data-source-items', fileName + '.py'), python, 'utf8')
        ]);
      }
    });

    dialog.attach();
  },
  // TODO: Very similar to newDataSourceItem
  // Could probably be a method of DataObject class
  newDataObject () {
    let dialog = new InputDialog({
      labelText: 'Filename',
      async callback (fileName) {
        let projectPath = config.projectPath();
        let python = `#!/usr/bin/env python

import json

def process(fullUrl, method, inHeaders, inputStream, remoteAddr, protocol):
    responseHeaders = {'Content-Type': ['application/json']}
    return json.dumps({}), responseHeaders, 200

`
        let meta = {
          'name': fileName,
          'stylesheet': '<See corresponding .py file>',
          'backendUri': ''
        }
        await Promise.all([
          fs.writeFile(path.join(projectPath, 'data-objects', fileName + '.meta.json'), JSON.stringify(meta, null, 4), 'utf8'),
          fs.writeFile(path.join(projectPath, 'data-objects', fileName + '.py'), python, 'utf8')
        ]);
      }
    });

    dialog.attach();
  },
  async upload () {
    atom.notifications.addInfo('Uploading files', {});
    try {
      // TODO: Move config out of dynapp/ and pass config to upload
      await this.sync.upload();
      atom.notifications.addInfo('Files are uploaded', {dismissable: true});
    } catch (e) {
      atom.notifications.addError('Upload failed. Check logs for more info.', {dismissable: true});
      throw e;
    }
  },
  // TODO: Probably move to dynapp/config.js
  // TODO: Or dynapp/config.js should move here
  async createConfig() {
    atom.notifications.addInfo('Config-fil skapas', {});

    let projectPath = config.projectPath();
    let dynappConfig = {
      'username': '<username>/<devgroups>',
      'password': '<password>',
      'group': '<projectGroup>',
      'app': '<appname>',
      'baseUrl': 'https://dynappbeta.wip.se/',
      'web': 'web'
    };
    let configFile = path.join(projectPath, 'dynappconfig.json');
    let configFileExists = await fs.exists(configFile);
    if (!configFileExists) {
      await fs.writeFile(configFile, JSON.stringify(dynappConfig, null, 4));
    }

    // TODO: Do this in sync?
    try {
      await fs.mkdir(path.join(projectPath, 'data-source-items'));
    } catch(ex) {
      // data-source-items already exists
    }
    // TODO: Do this in sync?
    try {
      await fs.mkdir(path.join(projectPath, 'data-objects'));
    } catch(ex) {
      // data-objects already exists
    }
    // TODO: Do this in sync?
    try {
      await fs.mkdir(path.join(projectPath, 'data-items'));
    } catch(ex) {
      // data-items already exists
    }

    await this.createIgnore(false);
  },
  deactivate() {
    this.subscriptions.dispose();
  },
  async download() {
    atom.notifications.addInfo('Downloading project', {});

    try {
      await this.sync.download();
      atom.notifications.addInfo('Project downloaded', {});
    } catch (e) {
      atom.notifications.addError('Project download failed. Check logs for more info.', {dismissable: true});
      throw e;
    }
  },
  async createIgnore (messages) {
    if (messages) {
      atom.notifications.addInfo('Ignore-fil skapas', {});
    }

    let projectPath = config.projectPath();
    let content = `^.dynapp-state$
^dynappconfig.json$
^data-items/version-android.json$
^data-items/version-ios.json$
node_modules/
.DS_Store
dist/
^data-items/web/
`;
    let file = path.join(projectPath, '.hgignore');
    let fileExists = await fs.exists(file);
    if (!fileExists) {
      await fs.writeFile(file, content);
    } else if (messages) {
      atom.notifications.addInfo('Ignore-fil finns redan', {});
    }
  }
};
