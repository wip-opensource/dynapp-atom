'use babel';

import WipAtomView from './dynapp-atom-view';
import {
  CompositeDisposable
} from 'atom';

const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const path = require('path')
var editedFiles = {}

var validateFilesToDownload = function(files) {
  for (file in files.fileList) {
    if (file.indexOf('.json') != -1) {

    } else if (file.indexOf('.css') != -1) {

    } else if (file.indexOf('.html') != -1) {

    } else if (file.indexOf('.js') != -1) {

    } else {
      delete files.fileList[file];
    }
  }
  return files;
}
var addListeners = function(){
  try{
    var filepath = atom.project.getPaths()[0] + '/wipconfig.json'
    var content = fs.readFileSync(filepath, 'utf8')
    var config = JSON.parse(content)
    var username = config.username;
    var password = config.password;
    var group = config.group;
    var app = config.app;


    var filepath = atom.project.getPaths()[0]

    fs.readdir(filepath, (err, files) => {
      files.forEach(file => {
        var fileobj = new File(filepath +'/'+ file)
        fileobj.onDidDelete(function(cb){
          var urlString = "https://dynappbeta.wip.se/dynapp-server/rest/groups/" + group + "/apps/" + app + "/data-items/" + file
          const settings = {
            buttons: [
              {
                onDidClick: function() {
                  var options = {
                    url: urlString,
                    method: 'DELETE',
                    auth: {
                      'user': username,
                      'pass': password
                    }
                  };

                  function callback(error, response, body) {
                    if(response.statusCode != 204){
                      atom.notifications.addError("Kunde inte ta bort filen", options)
                    }
                    else{
                      atom.notifications.addInfo("Filen är nu borttagen", options)
                    }
                  }
                  request(options, callback);

                },
                text: "TA BORT"
              }

            ]}
          atom.notifications.addWarning("Vill du ta bort denna fil även på serven?", settings)
        });
      });
    });

    atom.workspace.observeTextEditors(function(editor){

      editor.onDidSave(function(cb){
        console.log(cb)

          if(editedFiles[cb.path] === undefined){
            editedFiles[cb.path] = true
            var filepath = atom.project.getPaths()[0]
            var fileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'));
            if(fileObject.fileList[path.basename(cb.path)] != undefined){
              console.log("making dirty")
              fileObject.fileList[path.basename(cb.path)]['dirty'] = true;
              fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
            } else if(path.basename(cb.path) != 'wipconfig.json' && path.basename(cb.path) != ".files.json"){
              console.log(path.basename(cb.path))
              postFile(path.basename(cb.path)).then(function(){
                atom.notifications.addInfo("Filen: " + path.basename(cb.path) + " finns nu på serven", null)
              })

            }
          }

      })
    })
  }catch(ex){

  }
}

var postFile = function(file){
  return new Promise((resolve, reject) => {
    var cred = getCred()

    var filepath = atom.project.getPaths()[0] + '/' + file;
    var urlString = "https://dynappbeta.wip.se/dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + file
    var  headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Category': '2',

      };

    if (file.indexOf('.css') != -1) {
      headers['Content-Type'] = 'text/css'
    } else if (file.indexOf('.html') != -1) {
      headers['Content-Type'] = 'text/html'
    } else if (file.indexOf('.js') != -1) {
      headers['Content-Type'] = 'text/javascript'
    } else {
      return;
    }

    var content = fs.readFileSync(filepath, 'utf8')
    var options = {
      url: urlString,
      method: 'POST',
      headers: headers,
      body: content,
      auth: {
        'user': cred.username,
        'pass': cred.password
      }
    };

    function callback(error, response, body) {
      if(response.statusCode != 204){
        atom.notifications.addWarning("Kunde inte spara data. Kolla dina uppgifter i wipconfig.json", null)
        reject()
      }
      console.log(response)
      resolve()
    }
    request(options, callback);
  });
}

var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/wipconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
}

var uploadFiles = function(fileList) {
  var cred = getCred()

  var promises = []
  for (file in fileList) {
    if(fileList[file]['dirty']){

      console.log('uploading file: ' + file)

      var promise = new Promise((resolve, reject) => {
        var filepath = atom.project.getPaths()[0] + '/' + file;
        var urlString = "https://dynappbeta.wip.se/dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-items/" + file
        var  headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Category': fileList[file]['cat'],

          };

        if (file.indexOf('.css') != -1) {
          headers['Content-Type'] = 'text/css'
        } else if (file.indexOf('.html') != -1) {
          headers['Content-Type'] = 'text/html'
        } else if (file.indexOf('.js') != -1) {
          headers['Content-Type'] = 'text/javascript'
        } else {
          return;
        }

        var content = fs.readFileSync(filepath, 'utf8')
        var options = {
          url: urlString,
          method: 'PUT',
          headers: headers,
          body: content,
          auth: {
            'user': cred.username,
            'pass': cred.password
          }
        };

        function callback(error, response, body) {
          if(response.statusCode != 204){
            atom.notifications.addWarning("Kunde inte spara data. Kolla dina uppgifter i wipconfig.json", null)
          }
          console.log(response)


          resolve()
        }
        request(options, callback);
      });

      promises.push(promise)
    }
  }

  Promise.all(promises).then(function(obj){
    getFileList().then(function(result) {
      var filepath = atom.project.getPaths()[0]
      fs.writeFile(filepath + '/.files.json', JSON.stringify(result, null, 4));
      atom.notifications.addInfo("Filerna är nu uppladdade", null)
      editedFiles = {}
    });
  });

}

var downloadFile = function(file) {
  return new Promise(function(resolve,reject){
    var cred = getCred()

    filepath = atom.project.getPaths()[0]

    var options = {
      url: "https://dynappbeta.wip.se/dynapp-server/rest/groups/" +cred.group + "/apps/" + cred.app + "/data-items/" + file,
      auth: {
        user: cred.username,
        password: cred.password
      }
    }

    request(options, function(err, res, body) {
      if (err) {
        console.dir(err)
        reject()
        return
      }
      console.log(file)
      resolve()
      if (file.indexOf('.json') == -1) {
        fs.writeFile(filepath + '/' + file, body, 'binary', function(err) {});
      } else {
        try{
          var obj = JSON.parse(body)
          fs.writeFile(filepath + '/' + file, JSON.stringify(obj, null, 4));
        }
        catch(e){
          fs.writeFile(filepath + '/' + file, body, 'binary', function(err) {});
        }

      }
    })
  })
}

var getFileList = function() {
  return new Promise(function(resolve, reject) {
    var filepath = atom.project.getPaths()[0] + '/wipconfig.json'
    var content = fs.readFileSync(filepath, 'utf8')
    var config = JSON.parse(content)
    var username = config.username;
    var password = config.password;
    var group = config.group;
    var app = config.app;

    var options = {
      url: "https://dynappbeta.wip.se/dynapp-server/rest/groups/" + group + "/apps/" + app + "/data-items/",
      auth: {
        user: username,
        password: password
      }
    }

    request(options, function(err, res, body) {
      if (err) {
        console.dir(err)
        return
      }

      if(res.statusCode != 200){
        atom.notifications.addWarning("Kunde inte hämta data. Kolla dina uppgifter i wipconfig.json", null)
        reject()
        return
      }
      var fileList = JSON.parse(body)
      var obj = {
        fileList:fileList
      }
      resolve(obj)
    })
  })
}

export default {

  wipAtomView: null,
  modalPanel: null,
  subscriptions: null,


  activate(state) {
    this.wipAtomView = new WipAtomView(state.wipAtomViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.wipAtomView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    this.start()

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'dynapp-atom:downloadProject': () => this.download(),
      'dynapp-atom:createConfig': () => this.createConfig(),
      'dynapp-atom:uploadItems': () => this.uploadItems()
    }));
  },

  start() {
    addListeners()
  },
  uploadItems() {
    atom.notifications.addInfo("Filerna sparas", null)
    filepath = atom.project.getPaths()[0]
    var oldList = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'));
    oldList = oldList.fileList
    getFileList().then(function(newList) {
      newList = newList.fileList
      var serverFilesHasBeenEdited = false;
      for (listItem in oldList) {
        if (newList[listItem] == undefined || oldList[listItem]['etag'] !== newList[listItem]['etag']) {
          serverFilesHasBeenEdited = true;
          break;
        }
      }

      if (serverFilesHasBeenEdited) {
        let myNotification = new Notification("Det finns en nyare version av projektet", {
          body: 'Klicka här om du vill skriva över filerna på serven'
        })
        myNotification.onclick = () => {
          uploadFiles(oldList)
        }
      } else {
        uploadFiles(oldList)

      }
    });
  },
  createConfig() {
    console.log('Creating config file')
    atom.notifications.addInfo("Config-fil skapas", null)

    var wipconfig = {
      "username": "<username>/<devgroups>",
      "password": "<password>",
      "group": "<projectGroup>",
      "app": "<appname>"
    }

    var filepath = atom.project.getPaths()[0]

    fs.writeFile(filepath + '/wipconfig.json', JSON.stringify(wipconfig, null, 4));
    var file = new File(filepath + '/' + 'oskar')
  var mode = file.create()
  mode.then(function(cb){
    console.log(cb)
  })

  },
  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.wipAtomView.destroy();
  },

  serialize() {
    return {
      wipAtomViewState: this.wipAtomView.serialize()
    };
  },
  // download the project
  download() {
    console.log("Downloading files")
    atom.notifications.addInfo("Downloading project", null)
    getFileList().then(function(result) {
      var files = validateFilesToDownload(result)
      var filepath = atom.project.getPaths()[0]
      fs.writeFile(filepath + '/.files.json', JSON.stringify(files, null, 4));
      var promises = []
      for (file in files.fileList) {
        promises.push(downloadFile(file))
      }
      Promise.all(promises).then(function(){
        addListeners()
        atom.notifications.addInfo("Project downloaded", null)
        console.log("adding listeners")
      })

    });
  }
};
