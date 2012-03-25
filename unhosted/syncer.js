var syncer = (function() {
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
    if(localStorage['_unhosted$bearerToken']) {
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
          setInterval(work, pushInterval*1000);//will first trigger a pull if it's time for that
        }
        orsc({
          connected: true
        });
      }
      if(event.key=='_unhosted$dialogResult' && event.newValue) {
        try {
          console.log(JSON.parse(event.newValue));
        } catch(e) {
          console.log('unparseable dialog result');
        }
      }
    }, false);
    //TODO: deal with dialog failures
  }
  function disconnect() {
    localStorage.clear();
    orsc({
      connected: false
    });
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
  function pull(cb) {
    console.log('pull');
    var categories, storageInfo, bearerToken;
    try {
      categories=JSON.parse(localStorage['_unhosted$categories']);
      storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
      bearerToken=localStorage['_unhosted$bearerToken'];
    } catch(e) {
    }
    if(categories && storageInfo && bearerToken) {
      for(var i=0; i<categories.length; i++) {
        var client=remoteStorage.createClient(storageInfo, categories[i], bearerToken);
        client.get(indexKey, function(err, data) {
          if((!err) && data) {
            var remoteIndex = JSON.parse(data);
            var localIndex = getLocalIndex(category);
            JSON.parse(localStorage[clients[category]+'$'+indexKey]);
            var key;
            for(key in remoteIndex) {
              if(!localIndex[key] || localIndex[key] < remoteIndex[key]) {
                client.get(key, function(err, data) {
                  updateLocalIndex(category, key);
                  localStorage[category+'$'+key] = data;
                });
              }
            }
            var putIndex = false;
            for(key in localIndex) {
              if(!remoteIndex[key] || remoteIndex[key] < localIndex[key]) {
                putIndex = true;
                client.put(key, localStorage[category+'$'+key], function(err, data) {
                });
              }
            }
            //todo: deal with upload failures
            client.put(indexKey, JSON.stringify(localIndex), function(err, data) {
            });
          }
        });
      }
    }
    cb();//not really finished here yet actually
  }
  function push(cb) {
    console.log('push');
    for(var i=0;i<localStorage.length;i++) {
      var parts = localStorage.key(i).split('$');
      if(parts.length == 2 && parts[0] != '_unhosted') {
        var index = updateLocalIndex(parts[0], parts[1]);
        var storageInfo, bearerToken;
        try {
          storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
          bearerToken=localStorage['_unhosted$bearerToken'];
        } catch(e) {
        }
        if(storageInfo && bearerToken) {
          var client = remoteStorage.createClient(storageInfo, parts[0], bearerToken);
          client.put(indexKey, JSON.stringify(getLocalIndex(parts[0])), function(err, data) {
            client.put(parts[1], localStorage[parts.join('$')], function(err, data) {
            });
          });
        }
      }
    }
    cb();//not really finished here yet actually
  }
  function maybePull(now, cb) {
    if(localStorage['_unhosted$pullInterval']) {
      if(!localStorage['_unhosted$lastPullStartTime'] //never pulled yet
        || parseInt(localStorage['_unhosted$lastPullStartTime']) + localStorage['_unhosted$pullInterval']*1000 < now) {//time to pull
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
        || parseInt(localStorage['_unhosted$lastPushStartTime']) + localStorage['_unhosted$pushInterval']*1000 < now) {//time to push
        localStorage['_unhosted$lastPushStartTime']=now;
        push(cb);
      } else {
        cb();
      }
    } else {
      cb();
    }
  }
  function onLoad() {
    require(['./unhosted/remoteStorage'], function(drop) {
      remoteStorage=drop;
      if(localStorage['_unhosted$pushInterval']) {
        work();
        setInterval(work, localStorage['_unhosted$pushInterval']*1000);
      }
    });
  }
  function work() {
    var now = new Date().getTime();
    console.log(now);
    maybePull(now, function() {
      maybePush(now, function() {
      });
    });
  }
  function onReadyStateChange(cb) {
    orsc=cb;
    orsc({
      connected: (localStorage['_unhosted$bearerToken'] != null)
    });
  }
  function getUserAddress() {
    return localStorage['_unhosted$userAddress'];
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
