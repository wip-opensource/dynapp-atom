const request = require('request')
const fs = require('fs');
const {File} = require('atom')
const {Project} = require('atom')
const path = require('path')
let filelistHandeler = require('./filelistHandeler.js')

// Make a post request to the server for new files
var postFile = function(file){
  return new Promise((resolve, reject) => {
    var cred = getCred()

    var filepath = atom.project.getPaths()[0] + '/data-objects/' + file + '.json';
    var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-object-entities/" + file
    var  headers = {
        'Content-Type': 'application/json'
    };
    console.log(file)

    var content = fs.readFileSync(filepath, 'utf8')
    content = JSON.parse(content)
    content.name = file
    content = JSON.stringify(content)
    console.log(content)
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
        atom.notifications.addWarning("Kunde inte spara data. Kolla dina uppgifter i dynappconfig.json", null)
        reject()
      }
      console.log(response)
      filelistHandeler.saveFileListToLocal()
      addOnDeleteListener()
      resolve()
    }
    request(options, callback);
  });
}

module.exports.postFile = postFile;

var addOnDeleteListener = function(){
  try{
    var cred = getCred()
    var filepath = atom.project.getPaths()[0] + '/data-objects'
    fs.readdir(filepath, (err, files) => {
      files.forEach(file => {
        var fileName = ""
        if(file.indexOf('.json') != -1){
          fileName = path.basename(file, '.json')
        }  else if(file.indexOf('.py') != -1){
          fileName = path.basename(file, '.py')
        }
        var fileobj = new File(filepath +'/'+ file)
        fileobj.onDidDelete(function(cb){
          var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-object-entities/" + fileName
          const settings = {
            buttons: [
              {
                onDidClick: function() {
                  var options = {
                    url: urlString,
                    method: 'DELETE',
                    auth: {
                      'user': cred.username,
                      'pass': cred.password
                    }
                  };

                  function callback(error, response, body) {
                    if(response.statusCode != 204){
                      atom.notifications.addError("Kunde inte ta bort filen", options)
                    }
                    else{
                      atom.notifications.addInfo("Filen är nu borttagen, vänligen ta bort tillhörande fil", options)
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

  }catch(ex){

  }
}

module.exports.addOnDeleteListener = addOnDeleteListener;


var uploadObject = function(object, file){
  return new Promise(function(resolve, reject){
    var cred = getCred()
    console.log(file)

    if(!file['dirty']){
      resolve()
      return;
    }

    var urlString = cred.baseUrl + "dynapp-server/rest/groups/" + cred.group + "/apps/" + cred.app + "/data-object-entities/" + object
    var  headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

    var filepathJson = atom.project.getPaths()[0] + '/data-objects/' + object + '.json';
    var filepathPython =  atom.project.getPaths()[0] + '/data-objects/' + object + '.py'

    var content = fs.readFileSync(filepathJson, 'utf8')
    content = JSON.parse(content);
    var b64String = new Buffer(fs.readFileSync(filepathPython, 'utf8')).toString('base64');
    content.stylesheet = b64String
    content = JSON.stringify(content)
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
        atom.notifications.addWarning("Kunde inte spara alla filer. Kolla dina uppgifter i dynappconfig.json", null)
      }

      resolve()
    }
    request(options, callback);
  })
}
module.exports.uploadObject = uploadObject;

// get project credentials
var getCred = function(){
  var filepath = atom.project.getPaths()[0] + '/dynappconfig.json'
  var content = fs.readFileSync(filepath, 'utf8')
  var cred = JSON.parse(content)
  return cred
}


var downloadObject = function(name){
  return new Promise(function(resolve,reject){
    var cred = getCred()
    console.log("Downloading: " + name)

    filepath = atom.project.getPaths()[0]

    var options = {
      url: cred.baseUrl + "dynapp-server/rest/groups/" +cred.group + "/apps/" + cred.app + "/data-object-entities/" + name,
      headers:{
            'Accept': 'application/json',
          },
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

      var obj = JSON.parse(body)
      //console.log(obj)
      var b64String = obj.stylesheet
      var decodedString = new Buffer(b64String, 'base64').toString('utf8')
      fs.writeFile(filepath + '/data-objects/' + name + '.py', decodedString, 'binary', function(err) {});
      fs.writeFile(filepath + '/data-objects/' + name + '.json', JSON.stringify(obj, null, 4));
      resolve()
    });
  });
}

module.exports.downloadObject = downloadObject;
