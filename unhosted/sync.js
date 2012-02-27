var Syncer = function() {
  var clients = {};
  var indexCache = {};
  var indexKey;
  function getLocalIndex(category) {
    if(indexCache[category]) {//this is necessary because localStorage contents is not updated instantly on write
      return indexCache[category];
    }
    var str = localStorage[indexKey+'_index_'+category];
    if(str) {
      try {
        indexCache[category] = JSON.parse(str);
        return indexCache[category];
      } catch (e) {
      }
    }
    //build up index from scratch:
    indexCache[category] = {};
    for(var i = 0; i < localStorage.length; i++) {
      var keyParts = localStorage.key(i).split('$');
      if(keyParts.length == 2 && keyParts[0] == category) {
        indexCache[category][localStorage.key(i)] = 0;
      }
    }
    localStorage[indexKey+'_index_'+category] = JSON.stringify(indexCache[category]);
    return indexCache[category];
  }
  function updateLocalIndex(category, key) {
    getLocalIndex(category);//prime indexCache
    indexCache[category][key] = new Date().getTime();
    localStorage[indexKey+'_index_'+category] = JSON.stringify(indexCache[category]);
  }
  function init(setStorageInfo, setCategories, setToken, setIndexKey, cb) {
    indexKey = setIndexKey;
    require(['http://unhosted.org/remoteStorage-0.4.3.js'], function(remoteStorage) {
      for(var i in setCategories) {
        clients[setCategories[i]] = remoteStorage.createClient(setStorageInfo, setCategories[i], setToken);
      }
      sync(cb);
    });
  }
  function sync(cb) {
    for(var category in clients) {
      clients[category].get(indexKey, function(err, data) {
        if((!err) && data) {
          var remoteIndex = JSON.parse(data);
          var localIndex = getLocalIndex(category);
          JSON.parse(localStorage[clients[category]+'$'+indexKey]);
          var key;
          for(key in remoteIndex) {
            if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
              clients[category].get(key, function(err, data) {
                updateLocalIndex(category, key);
                localStorage[category+'$'+key] = data;
              });
            }
          }
          var putIndex = false;
          for(key in localIndex) {
            if(!remoteIndex[key] || remoteIndex[key] < localIndex[key]) {
              putIndex = true;
              clients[category].put(key, localStorage[category+'$'+key], function(err, data) {
              });
            }
          }
          //todo: deal with upload failures
          clients[category].put(indexKey, JSON.stringify(localIndex), function(err, data) {
          });
        }
      });
    }
    cb();//not really finished here yet actually
  }
  function push(e, cb) {
    if(!e.key) {//this happens on localStorage.clear()
      return;
    }
    var parts = e.key.split('$');
    if(parts.length != 2) {
      return;
    }
    var index = updateLocalIndex(parts[0], parts[1]);
    if(clients[parts[0]]) {
      clients[parts[0]].put(indexKey, JSON.stringify(getLocalIndex(parts[0])), function(err, data) {
        clients[parts[0]].put(parts[1], e.newValue, function(err, data) {
          cb();
        });
      });
    }
  }
  return {
    sync: sync, 
    init: init,
    push: push
  };
};
