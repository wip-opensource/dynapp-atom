const { CompositeDisposable } = require('atom');
const fs = require('fs-extra');
const path = require('path');
const InputDialog = require('../InputDialog.js');
const sync = require('../dynapp/sync');
const config = require('../dynapp/config');

var treeView;


// Ensure path exists
async function ensurePath(path) {
  if (!fs.existsSync(path)) {
    await fs.mkdir(path, {
      recursive: true
    });
  }
}

async function createWorkFolder(workpath) {
  await ensurePath(workpath);

  try {
    await fs.mkdir(path.join(workpath, 'data-source-items'));
  } catch(ex) {
    // data-source-items already exists
  }
  try {
    await fs.mkdir(path.join(workpath, 'data-objects'));
  } catch(ex) {
    // data-objects already exists
  }
  try {
    await fs.mkdir(path.join(workpath, 'data-items'));
  } catch(ex) {
    // data-items already exists
  }
}

module.exports = {
  subscriptions: null,
  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'dynapp-atom:download': () => this.download(),
      'dynapp-atom:createConfig': () => this.createConfig(),
      'dynapp-atom:createHgIgnore': () => this.createIgnore(true, '.hgignore'),
      'dynapp-atom:createGitIgnore': () => this.createIgnore(true, '.gitignore'),
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
      console.log('Uploading Done!');
      atom.notifications.addInfo('Files are uploaded', {dismissable: true});
    } catch (err) {
      console.error(err);
      var error_message = 'Check logs for more info.';
      if (err.name === 'StatusCodeError') {
        error_message = ''+err.statusCode +', '
        if (err.statusCode == 401 || err.statusCode == 403) {
          error_message += 'Check credentials.';
        } else if (err.statusCode == 404) {
          error_message += 'Check group, app and baseurl.';
        } else {
          error_message += 'Check logs for more info.';
        }
      } else if (err.name === 'RequestError' && err.error.code === 'ENOTFOUND') {
        error_message = "Couldn't find host.";
      }
      error_message = 'Upload failed. ' + error_message;
      atom.notifications.addError(error_message, {dismissable: true});
    }
  },
  async createConfig() {
    atom.notifications.addInfo('Creating config file', {});
    await config.create();
    await createWorkFolder(config.workPath());
    await this.createIgnore(false, '.hgignore');
    await this.createIgnore(false, '.gitignore');
  },
  consumeTreeView(_treeView) {
    treeView = _treeView
  },
  deactivate() {
    this.subscriptions.dispose();
  },
  async download() {
    console.log('Downloading...');
    atom.notifications.addInfo('Downloading project', {});

    try {
      await createWorkFolder(config.workPath());
      await this.sync.download();
      if (treeView) {
        // Force tree view to update by emulating two clicks on root folder
        var elem = treeView.entryForPath(config.projectPath())
        elem.click();
        elem.click();
      }
      console.log('Downloading Done!');
      atom.notifications.addInfo('Project downloaded', {});
    } catch (err) {
      console.error(err);
      var error_message = 'Check logs for more info.';
      if (err.name === 'StatusCodeError') {
        error_message = ''+err.statusCode +', '
        if (err.statusCode == 401 || err.statusCode == 403) {
          error_message += 'Check credentials.';
        } else if (err.statusCode == 404) {
          error_message += 'Check group, app and baseurl.';
        } else {
          error_message += 'Check logs for more info.';
        }
      } else if (err.name === 'RequestError' && err.error.code === 'ENOTFOUND') {
        error_message = "Couldn't find host.";
      } else if (err.name === 'Error' && err.message.indexOf('is this a zip file') !== -1) {
        error_message = "Couldn't parse zip. Is url correct?";
      }
      error_message = 'Download failed. ' + error_message;
      atom.notifications.addError(error_message, {dismissable: true});
    }
  },
  async createIgnore (messages, name) {
    if (messages) {
      atom.notifications.addInfo('Creating ignore file', {});
    }

    let projectPath = config.projectPath();
    let content = `syntax: regexp
.dynapp-state$
^dynappconfig.json$
data-items/version-android.json
data-items/version-ios.json
node_modules/
.DS_Store
dist/
data-items/web/
\#$
~$
`;
    let file = path.join(projectPath, name);
    let fileExists = await fs.exists(file);
    if (!fileExists) {
      await fs.writeFile(file, content);
    } else if (messages) {
      atom.notifications.addError('A file named ' + name + ' already exists.', {});
    }
  }
};
