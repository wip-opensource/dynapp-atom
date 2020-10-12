const fetch = require('node-fetch');
const {Base64} = require('js-base64');
const config = require('./config');
const urljoin = require('url-join');
const mime = require('mime-types');

function auth() {
  // TODO: Better interface to config
  let _auth = config.config();
  return {
    user: _auth.username,
    pass: _auth.password
  };
}

function authHeader() {
  var _auth = auth();
  return 'Basic ' + Base64.encode(_auth.user+':'+_auth.pass);
}

function _headers(headers) {
  return Object.assign({
    'User-Agent': 'dynapp-atom',
    'Authorization': authHeader()
  }, headers);
}

function getResponseData(resp) {
  return new Promise(function(resolve, reject) {
    var data = [];

    resp.body.on("data", function (chunk) {
      data.push(chunk);
    });
    resp.body.on("end", function () {
      var buf = Buffer.concat(data);
      resolve(buf);
    });
  });
}

function baseUrl() {
  // TODO: Better interface to config
  let _config = config.config();
  return urljoin(_config.baseUrl, 'dynapp-server/rest/groups', _config.group, 'apps', _config.app);
}

function baseUrlDataItems() {
  return urljoin(baseUrl(), 'data-items');
}

function baseUrlDataSourceItems() {
  return urljoin(baseUrl(), 'source');
}

function baseUrlDataObjects() {
  return urljoin(baseUrl(), 'data-object-entities');
}

function _modifyEntity(url, body, method, contentType, headers) {
  return fetch(url, {
    method: method,
    headers: Object.assign(
      _headers(),
      {
        'Content-Type': contentType || mime.lookup(url) || '',
        'X-Category': '2'
      },
      headers
    ),
    body: body,
  }).then(getResponseData);
}

function _deleteEntity(url) {
  return fetch(url, {
    method: 'DELETE',
    headers: _headers()
  }).then(getResponseData);
}

function headerifyDataItemMeta (meta) {
  var headers = {};
  if (meta.key != null)
    headers['X-Key'] = meta.key;
  if (meta.category != null)
    headers['X-Category'] = meta.category;
  if (meta.contentType != null)
    headers['Content-Type'] = meta.contentType;
  return headers;
}

function updateDataItem(dataItem, body, meta) {
  console.log('update data-item', dataItem);
  return _modifyEntity(urljoin(baseUrlDataItems(), dataItem), body, 'PUT', null, headerifyDataItemMeta(meta));
}

function createDataItem(dataItem, body, meta) {
  console.log('create data-item', dataItem);
  return _modifyEntity(urljoin(baseUrlDataItems(), dataItem), body, 'POST', null, headerifyDataItemMeta(meta));
}

function deleteDataItem(dataItem) {
  console.log('delete data-item', dataItem)
  return _deleteEntity(urljoin(baseUrlDataItems(), dataItem));
}

function updateDataSourceItem(dataSourceItem, body) {
  console.log('update data-source-item', dataSourceItem);
  return _modifyEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem), body, 'PUT', 'application/json');
}

function createDataSourceItem(dataSourceItem, body) {
  console.log('create data-source-item', dataSourceItem);
  return _modifyEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem), body, 'POST', 'application/json');
}

function deleteDataSourceItem(dataSourceItem) {
  console.log('delete data-source-item', dataSourceItem);
  return _deleteEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem));
}

function updateDataObject(dataObject, body) {
  console.log('create data-object', dataObject);
  return _modifyEntity(urljoin(baseUrlDataObjects(), dataObject), body, 'PUT', 'application/json');
}

function createDataObject(dataObject, body) {
  console.log('update data-object', dataObject);
  return _modifyEntity(urljoin(baseUrlDataObjects(), dataObject), body, 'POST', 'application/json');
}

function deleteDataObject(dataObject) {
  console.log('delete data-object', dataObject);
  return _deleteEntity(urljoin(baseUrlDataObjects(), dataObject));
}

function downloadApp() {
  return fetch(baseUrl(), {
    headers: _headers({
      'Accept': 'application/zip'
    })
  }).then(getResponseData);
}

module.exports = {
  updateDataItem,
  createDataItem,
  deleteDataItem,
  updateDataSourceItem,
  createDataSourceItem,
  deleteDataSourceItem,
  updateDataObject,
  createDataObject,
  deleteDataObject,
  downloadApp
};
