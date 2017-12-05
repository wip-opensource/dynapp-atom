const request = require('request-promise-native');
const config = require('./config');
const urljoin = require('url-join');
const mime = require('mime-types');

const _headers = {
  'User-Agent': 'dynapp-atom'
};

function auth() {
  // TODO: Better interface to config
  let _auth = config.config();
  return {
    user: _auth.username,
    pass: _auth.password
  }
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

function _modifyEntity(url, body, method) {
  return request({
    url: url,
    method: method,
    headers: Object.assign({
      'Content-Type': mime.lookup(url) || '',
      'X-Category': '2'
    }, _headers),
    body: body,
    auth: auth()
  });
}

function _deleteEntity(url) {
  return request({
    url: url,
    method: 'DELETE',
    headers: _headers,
    auth: auth()
  });
}

function updateDataItem(dataItem, body) {
  return _modifyEntity(urljoin(baseUrlDataItems(), dataItem), body, 'PUT');
}

function createDataItem(dataItem, body) {
  return _modifyEntity(urljoin(baseUrlDataItems(), dataItem), body, 'POST');
}

function deleteDataItem(dataItem) {
  return _deleteEntity(urljoin(baseUrlDataItems(), dataItem));
}

function updateDataSourceItem(dataSourceItem, body) {
  return _modifyEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem), body, 'PUT');
}

function createDataSourceItem(dataSourceItem, body) {
  return _modifyEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem), body, 'POST');
}

function deleteDataSourceItem(dataSourceItem) {
  return _deleteEntity(urljoin(baseUrlDataSourceItems(), dataSourceItem));
}

function updateDataObject(dataObject, body) {
  return _modifyEntity(urljoin(baseUrlDataObjects(), dataObject), body, 'PUT');
}

function createDataObject(dataObject, body) {
  return _modifyEntity(urljoin(baseUrlDataObjects(), dataObject), body, 'POST');
}

function deleteDataObject(dataObject) {
  return _deleteEntity(urljoin(baseUrlDataObjects(), dataObject));
}

function downloadApp() {
  return request({
    url: baseUrl(),
    headers: Object.assign({
      'Accept': 'application/zip'
    }, _headers),
    encoding: null,
    auth: auth()
  });
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
