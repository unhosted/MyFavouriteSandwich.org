define(['./remoteStorage'], function(remoteStorage) {
  //sync.js itself:
  return (function() {
    var indexCache = {};
    var indexKey;
    var readyState={};
    orsc=function(obj){console.log('ready state changed to:');console.log(obj);};
    oc=function(obj){console.log('incoming changeset:');console.log(obj);};
    ol=function(str){
      localStorage['_unhosted$debugLog'] = str;
    }
    function onLog(cb) {
      window.addEventListener('storage', function(e) {
        if(e.key == '_unhosted$debugLog') {
          cb(e.newValue);
        }
      }, false);
    }
    function changeReadyState(field, value) {
      readyState[field]=value;
      orsc(readyState);
    }
    //localStorage keys used by this lib:
    //_unhosted$userAddress
    //_unhosted$categories
    //_unhosted$storageInfo
    //_unhosted$bearerToken
    
    //_unhosted$pullInterval
    
    //_unhosted$lastPushStartTime
    //_unhosted$lastPullStartTime
    
    //_unhosted$lastPushEndTime
    //_unhosted$lastPullEndTime
   
    //for each [category]:
    //_unhosted$index:[category]

    function connect(userAddress, categories, pullInterval, dialogPath) {
      ol('syncer.connect('
        +JSON.stringify(userAddress)+', '
        +JSON.stringify(categories)+', '
        +JSON.stringify(pullInterval)+', '
        +JSON.stringify(dialogPath)+');');
      if(localStorage['_unhosted$bearerToken']) {
        console.log('err: already connected');
        return;
      }
      if(typeof(dialogPath) === 'undefined') {
        dialogPath = 'syncer/dialog.html';
      }
      if(typeof(pullInterval) === 'undefined') {
        pullInterval = 60;
      }
      localStorage['_unhosted$userAddress'] = userAddress;
      localStorage['_unhosted$categories'] = JSON.stringify(categories);
      localStorage['_unhosted$pullInterval'] = pullInterval;
      window.open(dialogPath);
      window.addEventListener('storage', function(event) {
        if(event.key=='_unhosted$bearerToken' && event.newValue) {
          if(pullInterval) {
            setInterval(work, pullInterval*1000);//will first trigger a pull if it's time for that
          }
          changeReadyState('connected', true);
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
    function parseObj(str) {
      var obj;
      try {
        obj = JSON.parse(str);
      } catch(e) {
      }
      if(obj) {//so str is parseable /and/ the result is not falsy
        return obj;
      } else {
        return {};
      }
    }
    function iterate(obj, itemCb, finishedCb, lastItem) {//helper function to async over an object's keys.
      if(typeof(obj) == 'object') {
        for(var thisItem in obj) {
          if(!lastItem) {
            itemCb(thisItem, function() {
              iterate(obj, itemCb, finishedCb, thisItem);
            });
            return;//execution will continue in the callback of itemCb
          } else if(thisItem == lastItem) {
            lastItem = undefined;//go execute on next one
          }
        }
      }
      finishedCb();
    }
    function pullIn(localIndex, remoteIndex, client, cb) {//iterates over remoteIndex, pulling where necessary
      iterate(remoteIndex, function(item, doneCb) {
        if(!localIndex[item] || localIndex[item] < remoteIndex[item]) {
          client.get(item+':'+remoteIndex[item], function(err, data) {
            if(!err) {
              var oldValue = localStorage[client.category+'$'+item];
              localIndex[item]=remoteIndex[item]
              localStorage[client.category+'$_index']=JSON.stringify(localIndex);
              localStorage[client.category+'$'+item]=data;
              oc({
                category: client.category,
                key: item,
                oldValue: oldValue,
                newValue: data,
                timestamp: remoteIndex[item]
              });
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
      iterate(localIndex, function(item, doneCb) {
        if(!remoteIndex[item] || remoteIndex[item] < localIndex[item]) {
          client.put(item+':'+localIndex[item], localStorage[client.category+'$'+item], function(err) {
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
      client.category = category;
      client.get('_index', function(err, data) {
        if(!err) {
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
    function maybePull(now, cb) {
      if(localStorage['_unhosted$pullInterval']) {
        if(!localStorage['_unhosted$lastPullStartTime'] //never pulled yet
          || parseInt(localStorage['_unhosted$lastPullStartTime']) + localStorage['_unhosted$pullInterval']*1000 < now) {//time to pull
          localStorage['_unhosted$lastPullStartTime']=now;
          changeReadyState('syncing', true);
          pull(function() {
            changeReadyState('syncing', false);
            cb();
          });
        } else {
          cb();
        }
      } else {
        cb();
      }
    }
    function pushItem(category, key, timestamp, indexStr, valueStr, cb) {
      console.log('push '+category+'$'+key+': '+valueStr);
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
      if(cb) {
        cb();//not really finished here yet actually
      }
    }
    function onLoad() {
      if(localStorage['_unhosted$pullInterval']) {
        delete localStorage['_unhosted$lastPullStartTime'];
        work();
        setInterval(work, localStorage['_unhosted$pullInterval']*1000);
      }
    }
    function work() {
      var now = new Date().getTime();
      maybePull(now, function() {
      });
    }
    function onReadyStateChange(cb) {
      orsc=cb;
      changeReadyState('connected', (localStorage['_unhosted$bearerToken'] != null));
    }
    function onChange(cb) {
      oc=cb;
    }
    function getUserAddress() {
      return localStorage['_unhosted$userAddress'];
    }
    function getItem(category, key) {
      try {
        return JSON.parse(localStorage[category+'$'+key]);
      } catch(e) {
        return null;
      }
    }
    function setItem(category, key, value) {
      var valueStr = JSON.stringify(value);
      if(key=='_index') {
        return 'item key "_index" is reserved, pick another one please';
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
          pushItem(category, key, now, indexStr, valueStr);
        }
      }
    }
    function removeItem(category, key) {
      if(key=='_index') {
        return 'item key "_index" is reserved, pick another one please';
      } else {
        var index;
        try {
          index=JSON.parse(localStorage[category+'$_index']);
        } catch(e) {
        }
        if(index) {
          delete index[key];
          var indexStr=JSON.stringify(index);
          localStorage[category+'$_index']=indexStr;
          delete localStorage[category+'$'+key]=valueStr;
          pushItem(category, key, now, indexStr, null);
        }
      }
    }
    function getCollection(category) {
      var index;
      try {
        index=JSON.parse(localStorage[category+'$_index']);
      } catch(e) {
      }
      if(index) {
        var items = [];
        for(var i in index) {
          try {
            items.push(JSON.parse(localStorage[category+'$'+i]));
          } catch(e) {
          }
        }
        return items;
      } else {
        return [];
      }
    }
    function display(barElement, categories, libDir, onChangeHandler) {
      if(libDir.length && libDir[libDir.length - 1] != '/') {//libDir without trailing slash
        libDir += '/'
      }
      document.getElementById(barElement).innerHTML = '<div id="remotestorage-loading">Loading...</div>'
        +'<a href="'+libDir+'inspector.html" target="_blank"><img src="'+libDir+'inspector-gadget.jpg" style="width:32px;height:32px"></a>'
        +'<div id="remotestorage-disconnected" style="display:none">'
        +'  <input id="remotestorage-useraddress" autofocus="" placeholder="user@server"'
        +'    style="width:20em; height:2.5em; padding-left:4em; background:url(\''+libDir+'remoteStorage-icon.png\') no-repeat .3em center"'
        +'> <input id="remotestorage-connect" type="submit" value="connect"'
        +'    style="cursor:pointer;background-color: #006DCC; background-image: -moz-linear-gradient(center top , #0088CC, #0044CC); background-repeat: repeat-x;'
        +'      border-color: rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25); border-radius: 4px; margin-left:-7em"'
        +'><a style="padding-left:2em" href="http://unhosted.org/#remotestorage">Got your remote storage yet?</a></div>'
        +'<div id="remotestorage-status"></div>';
      onReadyStateChange(function(obj) {
        if(obj.connected) {
          document.getElementById('remotestorage-disconnected').style.display='none';
          document.getElementById('remotestorage-loading').style.display='none';
          document.getElementById('remotestorage-status').style.display='block';
          document.getElementById('remotestorage-status').innerHTML=
            '<span>Connected to <strong>'
            +getUserAddress()
            +'</strong> <input type="submit" value="disconnect" id="remotestorage-disconnect"></div>'
            +(obj.syncing?' Syncing... ':'')
            +'</span>';
          document.getElementById('remotestorage-disconnect').onclick= function() { 
            localStorage.clear();
            onChangeHandler({key: null, oldValue: null, newValue: null});
            changeReadyState('connected', false);
          }
        } else {
          document.getElementById('remotestorage-loading').style.display='none';
          document.getElementById('remotestorage-status').style.display='none';
          document.getElementById('remotestorage-disconnected').style.display='block';
          document.getElementById('remotestorage-connect').onclick = function() {
            connect(document.getElementById('remotestorage-useraddress').value, categories, 10, libDir+'dialog.html');
          };
        }
      });
      onChange(onChangeHandler);
    }
    onLoad();
    return {
      getItem       : getItem,
      getCollection : getCollection,
      setItem       : setItem,
      removeItem    : removeItem,
      display       : display,
      onLog         : onLog
    };
  })();
  //API:
  //
  // - call display(barElement, categories, libDir, onChangeHandler({key:.., oldValue:.., newValue:..}));
  // - getCollection retrieves the array of items regardless of their id (so it makes sense to store the id inside the item)
  // - CRUD: getItem gets one item. setItem for create and update. remoteItem for delete.
  //
  // a note on sync:
  // if just one client connects, then it will feel like localStorage while the user is connected. the only special case there is the moment the user connects.
  // when the page loads for the first time, there will be no data. then the user connects, and your app will receive onChange events. make sure you handle these well.
  // in fact, your app should already have a handler for 'storage' events, because they occur when another tab or window makes a change to localStorage.
  // so you'll be able to reuse that function.
  //
  // if the user tries to leave the page while there is still unsynced data, a 'leave page?' alert will be displayed. disconnecting while offline will lead to loss of data too.
  // but as long as you don't disconnect, it'll all be fine, and sync will resume when the tab is reopened and/or connectivity is re-established.
  //
  // when another device or browser makes a change, it will come in through your onChange handler. it will 'feel' like a change that came from another tab.
  // when another device makes a change while either that device or you, or both are disconnected from the remoteStorage, the change will come in later, and conflict resolution 
  // will be per item, on timestamp basis. note that these are the timestamps generated on the devices, so this only works well if all devices have their clocks in sync.
  // in all cases, you will get an event on your onChange handler for each time data is changed by another device. the event will contain both the old and the new value of the item,
  // so you can always override a change by issuing a setItem command back to the oldValue.

});
