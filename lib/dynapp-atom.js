'use babel';

import WipAtomView from './dynapp-atom-view';
import {
  CompositeDisposable
} from 'atom';

const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')
var editedFiles = {}
var datasourceHandeler = require('./../DatasourceHandeler.js')
var dataitemsHandeler = require('./../DataitemsHandeler.js')
var filelistHandeler = require('./../FilelistHandeler.js')
var dataObjectsHandeler = require('./../DataObjectsHandeler.js')


// download only json, css, html and js
var validateFilesToDownload = function(files) {

  for (file in files.fileList) {
    if (file.indexOf('.json') != -1) {

    } else if (file.indexOf('.css') != -1) {

    } else if (file.indexOf('.html') != -1) {

    } else if (file.indexOf('.js') != -1) {

    } else if(file.indexOf('.properties') != -1){
      
    }
    else {
      delete files.fileList[file];
    }
  }


  return files;
}


// add listeners for all files
var addListeners = function(){
  dataitemsHandeler.addOnDeleteListener();
  datasourceHandeler.addOnDeleteListener();
  dataObjectsHandeler.addOnDeleteListener();

  try{
    atom.workspace.observeTextEditors(function(editor){
      editor.onDidSave(function(cb){
        if(cb.path.indexOf('.files') != -1 || cb.path.indexOf('dynappconfig') != -1){
          return;
        }
          if(editedFiles[cb.path] === undefined){
            editedFiles[cb.path] = true
            var filepath = atom.project.getPaths()[0]
            var fileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'));

            if(cb.path.indexOf('data-source-items') != -1){
              if(fileObject.dataSources[path.basename(cb.path, '.py')] != undefined){
                console.log("making dirty")
                fileObject.dataSources[path.basename(cb.path, '.py')]['dirty'] = true
                fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
              }
              else if(fileObject.dataSources[path.basename(cb.path, '.json')] != undefined){
                console.log("making dirty")
                fileObject.dataSources[path.basename(cb.path, '.json')]['dirty'] = true
                fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
              }
            }
            else if(cb.path.indexOf('data-objects') != -1){
              if(fileObject.dataObjects[path.basename(cb.path, '.py')] != undefined){
                console.log("making dirty")
                fileObject.dataObjects[path.basename(cb.path, '.py')]['dirty'] = true
                fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
              }
              else if(fileObject.dataObjects[path.basename(cb.path, '.json')] != undefined){
                console.log("making dirty")
                fileObject.dataObjects[path.basename(cb.path, '.json')]['dirty'] = true
                fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
              }
            }
            else if(fileObject.fileList[path.basename(cb.path)] != undefined){
              console.log("making dirty")
              fileObject.fileList[path.basename(cb.path)]['dirty'] = true;
              fs.writeFile(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
            } else if(path.basename(cb.path) != 'dynappconfig.json' && path.basename(cb.path) != ".files.json"){
              dataitemsHandeler.postFile(path.basename(cb.path)).then(function(){
                atom.notifications.addInfo("Filen: " + path.basename(cb.path) + " finns nu på serven", null)
              })

            }
          }
      })
    })
  } catch(ex){}
}

// get project credentials
var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
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
      'dynapp-atom:uploadItems': () => this.uploadItems(),
      'dynapp-atom:newItem': () => this.newItem(),
      'dynapp-atom:newObject': () => this.newObject(),
      'dynapp-atom:newSource': () => this.newSource()

    }));
  },
  newSource(){
    var InputDialog = require('./../Input-dialog.js')

    var dialog = new InputDialog({
      labelText:"Filename",
      callback:function(text){
        filepath = atom.project.getPaths()[0]
        text = path.parse(text)
        text = text.name
        filepath = atom.project.getPaths()[0]
        var obj = {
          "name": "",
          "stylesheet": "",
          "dataSourceUri": "",
          "cacheSeconds": 0,
          "jtidy": false,
          "category": 2,
          "key": "",
          "cron": false
        }

        let python = "#!/usr/bin/env python \n\nimport json \n\ndef transform(logger, item, username, password, parameterMap): \n    response = {} \n    return 200, json.dumps(response)"
        var b64String = new Buffer(python).toString('base64');
        obj.stylesheet = b64String;
        obj.name = text;
        fs.writeFileSync(filepath + '/data-source-items/' + text + '.json', JSON.stringify(obj, null, 4));
        fs.writeFileSync(filepath + '/data-source-items/' + text + '.py', python, 'binary', function(err) {});
        //datasourceHandeler.postFile(path.basename(text)).then(function(){
          //atom.notifications.addInfo("Filen: " + path.basename(text) + " finns nu på serven", null)
        //})
        var filepath = atom.project.getPaths()[0]
        var fileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'))
        fileObject["dataSources"][text] = {dirty:true}

        fs.writeFileSync(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));

      }
    });

    dialog.attach()
  },
  newObject(){
    var InputDialog = require('./../Input-dialog.js')

    var dialog = new InputDialog({
      labelText:"Filename",
      callback:function(text){
        filepath = atom.project.getPaths()[0]
        text = path.parse(text)
        text = text.name
        var obj = {
          "name": "",
          "stylesheet": "",
          "backendUri": ""
        }
        let python = "#!/usr/bin/env python \n\nimport json \n\ndef process(fullUrl, method, inHeaders, inputStream, remoteAddr, protocol): \n    responseHeaders = {'Content-Type': ['application/json']} \n    return json.dumps({}), responseHeaders, 200"
        var b64String = new Buffer(python).toString('base64');
        obj.stylesheet = b64String;
        obj.name = text
        fs.writeFileSync(filepath + '/data-objects/' + text + '.json', JSON.stringify(obj, null, 4));

        fs.writeFileSync(filepath + '/data-objects/' + text + '.py', python, 'binary', function(err) {});
        //dataObjectsHandeler.postFile(path.basename(text)).then(function(){
          //atom.notifications.addInfo("Filen: " + path.basename(text) + " finns nu på serven", null)
        //})

        var filepath = atom.project.getPaths()[0]
        var fileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'))
        fileObject["dataObjects"][text] = {dirty:true}

        fs.writeFileSync(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));

      }
    });

    dialog.attach()
  },
  newItem(){
    var InputDialog = require('./../Input-dialog.js')

    var dialog = new InputDialog({
      labelText:"Filename",
      callback:function(text){
        filepath = atom.project.getPaths()[0]
        var obj = {}

        fs.writeFile(filepath + '/data-items/' + text, "write here", 'binary', function(err) {});
        //dataitemsHandeler.postFile(path.basename(text)).then(function(){
          //atom.notifications.addInfo("Filen: " + path.basename(text) + " finns nu på serven", null)
        //})
        var filepath = atom.project.getPaths()[0]
        var fileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'))
        fileObject["fileList"][text] = {dirty:true}

        fs.writeFileSync(filepath + '/.files.json', JSON.stringify(fileObject, null, 4));
      }
    });

    dialog.attach()
  },
  start() {
    addListeners()

  },
  uploadItems() {
    atom.notifications.addInfo("Filerna sparas", null)
    filepath = atom.project.getPaths()[0]
    var oldList = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'));
    var oldSources = oldList.dataSources
    var oldObjects = oldList.dataObjects
    oldList = oldList.fileList
    filelistHandeler.getFileList().then(function(newList) {
      var newSources = newList.dataSources
      var newObjects = newList.dataObjects
      newList = newList.fileList

      let promises = []

      // for data items
      var serverFilesHasBeenEdited = false;
      for (listItem in oldList) {
        //if (newList[listItem] == undefined || oldList[listItem]['etag'] !== "\""  + newList[listItem]['etag'] + "\"") {
          //serverFilesHasBeenEdited = true;
          //console.log(oldList[listItem]['etag'] + " " + newList[listItem]['etag'])

        //}

        promises.push(dataitemsHandeler.uploadFile(oldList[listItem], listItem))

      }

      // for data sources
      for (source in oldSources) {
        //if (newSources[source] == undefined || oldSources[source]['etag'] !== "\"" + newSources[source]['etag'] + "\"" ) {
          //serverFilesHasBeenEdited = true;
          //console.log(oldSources[source]['etag'] + " " + newSources[source]['etag'])

        //}
        promises.push(datasourceHandeler.uploadSource(source, oldSources[source]))
      }

      // for data objects
      for (object in oldObjects) {
        //if (newObjects[object] == undefined || oldObjects[object]['etag'] !== "\"" + newObjects[object]['etag'] + "\"" ) {
          //serverFilesHasBeenEdited = true;
          //console.log(oldList[listItem]['etag'] + " " + newList[listItem]['etag'])

        //}

        promises.push(dataObjectsHandeler.uploadObject(object, oldObjects[object]))

      }

      if(!serverFilesHasBeenEdited){
        Promise.all(promises).then(function(obj){
          filelistHandeler.getFileList().then(function(result) {

            //var filepath = atom.project.getPaths()[0]
            //fs.writeFile(filepath + '/.files.json', JSON.stringify(result, null, 4));
            atom.notifications.addInfo("Filerna är nu uppladdade", null)
          });
        });
      }

      editedFiles = {}
    });
  },
  createConfig() {
    console.log('Creating config file')
    atom.notifications.addInfo("Config-fil skapas", null)

    var dynappconfig = {
      "username": "<username>/<devgroups>",
      "password": "<password>",
      "group": "<projectGroup>",
      "app": "<appname>",
      "baseUrl":"https://dynappbeta.wip.se/"
    }

    var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
    if (fs.existsSync(filepath) == false) {
      fs.writeFile(filepath, JSON.stringify(dynappconfig, null, 4));
    }

    filepath = atom.project.getPaths()[0]

    try{
      fs.mkdirSync(filepath + '/data-source-items');
    }catch(ex){
      console.log("data-source-items already exists")
    }

    try{
        fs.mkdirSync(filepath + '/data-objects');

      }catch(ex){
        console.log("data-objects already exists")
      }

      try{
        fs.mkdirSync(filepath + '/data-items');

      }catch(ex){
        console.log("data-items already exists")
      }
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
    filelistHandeler.getFileList().then(function(result) {
      var files = validateFilesToDownload(result)
      var filepath = atom.project.getPaths()[0]
      var promises = []
      // if the project is downloaded
      if (fs.existsSync(filepath + '/.files.json') == true) {
        var localFileObject = JSON.parse(fs.readFileSync(filepath + '/.files.json', 'utf8'));

        // Data items
        for(object in files.fileList){
          if(localFileObject.fileList[object] != undefined){
            promises.push(dataitemsHandeler.downloadFile(object, localFileObject.fileList[object]['etag']))
          } else{
            promises.push(dataitemsHandeler.downloadFile(object, undefined))
          }
        }

        for(object in files.dataSources){
          if(localFileObject.dataSources[object] != undefined){
            promises.push(datasourceHandeler.downloadSource(object, localFileObject.dataSources[object]['etag']))
          } else{
            promises.push(datasourceHandeler.downloadSource(object, undefined))
          }
        }

        for(object in files.dataObjects){
          if(localFileObject.dataObjects[object] != undefined){
            promises.push(dataObjectsHandeler.downloadObject(object, localFileObject.dataObjects[object]['etag']))

          }else {
            promises.push(dataObjectsHandeler.downloadObject(object))

          }
        }
      }
      // first time for this project
    else {
      localFileObject = files
      for (file in files.fileList) {
        promises.push(dataitemsHandeler.downloadFile(file))
      }
      for(source in files.dataSources){
        promises.push(datasourceHandeler.downloadSource(source))
      }

      for(object in files.dataObjects){
        promises.push(dataObjectsHandeler.downloadObject(object));
      }

    }
    Promise.all(promises).then(function(cb){
      for(obj in cb){
        obj =cb[obj]

        if(obj == undefined){
          continue;
        }
        if(localFileObject[obj.list][obj.fileName] != undefined){
          localFileObject[obj.list][obj.fileName]['etag'] = obj.etag;

        } else {
          localFileObject[obj.list][obj.fileName] = {}
          localFileObject[obj.list][obj.fileName]['etag'] = obj.etag
        }
      }

      fs.writeFileSync(filepath + '/.files.json', JSON.stringify(localFileObject, null, 4));

      addListeners()
      atom.notifications.addInfo("Project downloaded", null)
    })


    });
  }
};
