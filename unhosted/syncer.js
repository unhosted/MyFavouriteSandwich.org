var syncer = (function() {
  var clients = {};
  var indexCache = {};
  var indexKey;
  var orsc=function(obj){console.log('ready state changed to:');console.log(obj);};
  //localStorage keys used by this lib:
  //_unhosted$userAddress
  //_unhosted$categories
  //_unhosted$storageInfo
  //_unhosted$bearerToken
  
  //_unhosted$pushInterval
  //_unhosted$pullInterval
  
  //_unhosted$lastPushStartTime
  //_unhosted$lastPullStartTime
  
  //_unhosted$lastPushEndTime
  //_unhosted$lastPullEndTime
 
  //for each [category]:
  //_unhosted$index:[category]

  function connect(userAddress, categories, pushInterval, pullInterval, dialogPath) {
    var userAddress=localStorage['_unhosted$userAddress'];
    if(userAddress) {
      console.log('err: already connected');
      return;
    }
    if(typeof(dialogPath) === 'undefined') {
      dialogPath = '/unhosted/dialog.html';
    }
    if(typeof(pullInterval) === 'undefined') {
      pullInterval = 60;
    }
    if(typeof(pushInterval) === 'undefined') {
      pushInterval = 6;
    }
    if(pullInterval<pushInterval) {
      console.log('err: pullInterval should be greater than or equal to pushInterval. Set both to 0 to disable timed sync altogether');
      return;
    }
    localStorage['_unhosted$userAddress'] = userAddress;
    localStorage['_unhosted$categories'] = JSON.stringify(categories);
    localStorage['_unhosted$pushInterval'] = pushInterval;
    localStorage['_unhosted$pullInterval'] = pullInterval;
    window.open(dialogPath);
    window.addEventListener('storage', function(event) {
      if(event.key=='_unhosted$bearerToken' && event.newValue) {
        if(pushInterval) {
          setInterval(work, pushInterval);//will first trigger a pull if it's time for that
        }
      }
    }, false);
    //TODO: deal with dialog failures
  }
  function disconnect() {
    localStorage.clear();
  }
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
            indexCache[category][keyParts[1]] = 0;
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
        require(['./remoteStorage-0.4.5'], function(remoteStorage) {
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
  function pull() {
    console.log('pull');
  }
  function push() {
    console.log('push');
  }
  function maybePull(now, cb) {
    if(localStorage['_unhosted$pullInterval']) {
      if(!localStorage['_unhosted$lastPullStartTime'] //never pulled yet
        || localStorage['_unhosted$lastPullStartTime'] + localStorage['_unhosted$pullInterval'] < now) {//time to pull
        localStorage['_unhosted$lastPullStartTime']=now;
        pull(cb);
      } else {
        cb();
      }
    } else {
      cb();
    }
  }
  function maybePush(now, cb) {
    if(localStorage['_unhosted$pushInterval']) {
      if(!localStorage['_unhosted$lastPushStartTime'] //never pushed yet
        || localStorage['_unhosted$lastPushStartTime'] + localStorage['_unhosted$pushInterval'] < now) {//time to push
        localStorage['_unhosted$lastPushStartTime']=now;
        push();
      } else {
        cb();
      }
    } else {
      cb();
    }
  }
  function onLoad() {
    if(localStorage['_unhosted$pushInterval']) {
      setInterval(work, pushIntervalocalStorage['_unhosted$pushInterval']);
    }
  }
  function work() {
    var now = new Date().getTime();
    maybePull(now, function() {
      maybePush(now, function() {
      });
    });
  }
  function onReadyStateChange(cb) {
    orsc=cb;
    orsc({
      status: 'clear'
    });
  }
  function getUserAddress() {
    return 'bla';
  }
  onLoad();
  return {
    connect            : connect,//(userAddress, categories, pushInterval=6, pullInterval=60, dialog='/unhosted/dialog.html'), also forces a first pull & push and starts timers
    disconnect         : disconnect,//(), also forces a last push and stops timers
    push               : push,//() for instance when the user hits explicitly 'go offline'
    pull               : pull,//() for instance when the user hits explicitly 'refresh view'
    onReadyStateChange : onReadyStateChange,
    getUserAddress     : getUserAddress
  };
  //to catch the sync state, look for frame messages starting with '_unhosted:'
})();
