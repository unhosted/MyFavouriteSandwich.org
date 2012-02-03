
define(['./ajax'], function(ajax) {
    function normalizeKey(key) {
      var i = 0;
      while(i < key.length && key[i] =='u') {
       i++;
      }
      if((i < key.length) && (key[i] == '_')) {
        key = 'u'+key;
      }
      return key;
    }
    function doCall(method, key, value, token, cb, deadLine) {
      var ajaxObj = {
        url: key,
        method: method,
        success: cb
      }
      ajaxObj.headers= {Authorization: 'Bearer '+token};
      ajaxObj.fields={withCredentials: 'true'};
      if(method!='GET') {
        ajaxObj.data=value;
      }
      ajax.ajax(ajaxObj);
    }
    function get(storageAddress, token, key, cb) {
      doCall('GET', storageAddress+normalizeKey(key), null, token, cb);
    }
    function put(storageAddress, token, key, value, cb) {
      doCall('PUT', storageAddress+normalizeKey(key), value, token, cb);
    }
    function delete(storageAddress, token, key, cb) {
      doCall('DELETE', storageAddress+normalizeKey(key), null, token, cb);
    }
    return {
      get: get,
      put: put,
      delete: delete
    }
});
