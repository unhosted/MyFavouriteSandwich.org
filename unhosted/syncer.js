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
  function parseObj(str) {
    try {
      return JSON.parse(str);
    } catch(e) {
      return {};
    }
  }
  function iterate(index, itemCb, finishedCb, lastItem) {//helper function to async over an Array.
    var thisItem;
    for(var item in index) {
      if(lastItem==undefined) {
        thisItem=item;
        break;
      }
      if(item == lastItem) {
        lastItem=undefined;
      }
    }
    if(thisItem==undefined) {
      finishedCb();
    } else {
      itemCb(item, function() {
        iterate(index, itemCb, finishedCb, thisItem);
      });
    }
  }
  function pullIn(localIndex, remoteIndex, client, cb) {//iterates over remoteIndex, pulling where necessary
    iterate(remoteIndex, function(item, doneCb) {
      if(!localIndex[item] || localIndex[item] < remoteIndex[item]) {
        client.get(item, function(err, data) {
          if(!err) {
            localIndex[item]=remoteIndex[item]
            localStorage[category+'$_index']=JSON.stringify(localIndex);
            localStorage[category+'$'+item]=data;
          }
          doneCb();
        });
      } else {
        doneCb();
      }
    }, cb);
  }
  function pushOut(localIndex, remoteIndex, client, cb) {//iterates over localIndex, pushing where necessary
    var havePushed=false;
    iterate(localIndex, function(item) {
      if(!remoteIndex[item] || remoteIndex[item] < localIndex[item]) {
        client.put(item, localStorage[category+'$'+item], function(err) {
          if(err) {
            console.log('error pushing: '+err);
          } else {//success reported, so set remoteIndex timestamp to ours
            remoteIndex[item]=localIndex[item];
            havePushed=true;
          }
          doneCb();
        });
      } else {
        doneCb();
      }
    }, function() {
      if(havePushed) {
        client.put('_index', JSON.stringify(remoteIndex), function(err) {
          if(err) {
            console.log('error pushing index: '+err);
          }
          cb();
        });
      } else {
        cb();
      }
    });
  }
  function pullCategory(storageInfo, category, bearerToken, cb) {//calls pullIn, then pushOut for a category
    var client=remoteStorage.createClient(storageInfo, category, bearerToken);
    client.get('_index', function(err, data) {
      if((!err) && data) {
        var remoteIndex=parseObj(data);
        var localIndex = parseObj(localStorage[category+'$_index']);
        pullIn(localIndex, remoteIndex, client, function() {
          pushOut(localIndex, remoteIndex, client, cb);
        });
      }
    });
  }
  function pullCategories(storageInfo, categories, bearerToken, cb) {//calls pullCategory once for every category
    if(categories.length) {
      var thisCat=categories.shift();
      pullCategory(storageInfo, thisCat, bearerToken, function() {
        pullCategories(storageInfo, categories, bearerToken, cb);
      });
    } else {
      cb();
    }
  }
  function pull(cb) {//gathers settings and calls pullCategories
    console.log('pull');
    var categories, storageInfo, bearerToken;
    try {
      categories=JSON.parse(localStorage['_unhosted$categories']);
      storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
      bearerToken=localStorage['_unhosted$bearerToken'];
    } catch(e) {
    }
    if(categories && storageInfo && bearerToken) {
      pullCategories(storageInfo, categories, bearerToken, cb);
    }
  }
  function pushItem(category, key, timestamp, indexStr, valueStr, cb) {
    console.log('push '+category+'$'+valueStr);
    if(category != '_unhosted') {
      var storageInfo, bearerToken;
      try {
        storageInfo=JSON.parse(localStorage['_unhosted$storageInfo']);
        bearerToken=localStorage['_unhosted$bearerToken'];
      } catch(e) {
      }
      if(storageInfo && bearerToken) {
        var client = remoteStorage.createClient(storageInfo, category, bearerToken);
        client.put('_index', indexStr, function(err, data) {
          client.put(key+':'+timestamp, valueStr, function(err, data) {
          });
        });
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
  function onLoad() {
    require(['./unhosted/remoteStorage'], function(drop) {
      remoteStorage=drop;
      if(localStorage['_unhosted$pullInterval']) {
        delete localStorage['_unhosted$lastPullStartTime'];
        work();
        setInterval(work, localStorage['_unhosted$pullInterval']*1000);
      }
    });
  }
  function work() {
    var now = new Date().getTime();
    maybePull(now, function() {
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
  function setItem(category, key, valueStr, cb) {
    if(!cb) {
      cb=function(err) {
        if(err) {
          console.log('setItem without a callback, suffered error:'+err);
        }
      };
    }
    if(key=='_index') {
      cb('item key "_index" is reserved, pick another one please');
    } else {
      var currValStr = localStorage[category+'$'+key];
      if(valueStr != currValStr) {
        var now = new Date().getTime();
        var index;
        try {
          index=JSON.parse(localStorage[category+'$_index']);
        } catch(e) {
        }
        if(!index) {
          index={};
        }
        index[key]=now;
        var indexStr=JSON.stringify(index);
        localStorage[category+'$_index']=indexStr;
        localStorage[category+'$'+key]=valueStr;
        pushItem(category, key, now, indexStr, valueStr, cb);
      }
    }
  }
  onLoad();
  return {
    connect            : connect,//(userAddress, categories, pullInterval=60, dialog='/unhosted/dialog.html'), also forces a first pull & push and starts timers
    disconnect         : disconnect,//(), also forces a last push and stops timers
    setItem            : setItem,//() for instance when the user explicitly hits 'go offline'
    pull               : pull,//() for instance when the user explicitly hits 'refresh view'
    onReadyStateChange : onReadyStateChange,
    getUserAddress     : getUserAddress
  };
  //to catch the sync state, look for frame messages starting with '_unhosted:'
})();

// remote data structure:
// index
// favSandwich:timestamp
// 

// we can't tell when a key has changed, and don't want to keep sha's of them. so the user should connect(), disconnect(), and then
// getItem, setItem, removeItem, length, key on remoteStorage instead of on localStorage
// fixItem to make sure it never gets expulsed from cache and is always prefetched.
// or fetchItems and then synchronous getItem
// adn then flushItems.
//
// or have localStorage, synced, and remote.
// connect userAddress, pullInterval, scopes, cb(err) will load cache according to cache list
// disconnect cb(err) will remove cache and flush through any pending writes.
// 
// getItem key, cb //adds the item to the cache and to the cache list.
// setItem key, value, cb(err) //cache with writethrough
// removeItem key, value, cb(err) //remove from remote and, if present, also from cache
//
// length - will give the remote length
// key - int -> key on remote
// cached - int -> boolean
//
// flushItem category$item, cb(err) //remove only from cache and cache list
// storeItem category$item, value, cb(err) only store remotely, don't add to cache or cache list
// fetchItem [user@host/]category$item, cb(err, data)
//
