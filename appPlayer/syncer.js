var Syncer = function() {
  var client;
  var indexKey;
  return {
    init: function(setStorageInfo, setCategory, setToken, setIndexKey) {
      indexKey = setIndexKey || '_syncer';
      if(!localStorage[indexKey]) {
        localStorage[indexKey] = JSON.stringify({});
      }
      require(['http://unhosted.org/remoteStorage-0.4.3.js'], function(remoteStorage) {
        client = remoteStorage.createClient(setStorageInfo, setCategory, setToken);
        client.get(indexKey, function(err, data) {
          if((!err) && data) {
            var remoteIndex = JSON.parse(data);
            var localIndex = JSON.parse(localStorage[indexKey]);
            var key;
            for(key in remoteIndex) {
              if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
                client.get(key, function(err, data) {
                  localIndex = JSON.parse(localStorage[indexKey]);
                  localIndex[key] = remoteIndex[key];
                  localStorage[indexKey] = JSON.stringify(localIndex);
                  localStorage[key] = data;
                });
              }
            }
          }
        });
      });
    },
    push: function(e) {
      var now = new Date().getTime();
      var index = JSON.parse(localStorage[indexKey]);
      index[e.key] = now;
      localStorage[indexKey] = JSON.stringify(index);
      if(client) {
        client.put(indexKey, localStorage[indexKey], function(err, data) {
          client.put(e.key, e.newValue, function(err, data) {});
        });
      } 
    }
  };
};
