require(['http://unhosted.org/remoteStorage-0.4.2.js'], function(remoteStorage) {
  function show() {
    var sandwich = JSON.parse(

      //GET FROM LOCAL STORAGE:
      localStorage.getItem('favSandwich')

    );
    if(sandwich) {
      document.getElementById('firstIngredient').value = sandwich.ingredients[0];
      document.getElementById('secondIngredient').value = sandwich.ingredients[1];
      for(var i=0;i < 2; i++) {
        if(!(sandwich.ingredients[i])) {
          sandwich.ingredients[i]='...';
        }
      }
      document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has <strong>'
        +sandwich.ingredients[0]
        +'</strong> and <strong>'
        +sandwich.ingredients[1]
        +'</strong> on it';
    } else {
      document.getElementById('showIngredients').innerHTML = 'My favourite sandwich has';
      document.getElementById('firstIngredient').value = '';
      document.getElementById('secondIngredient').value = '';
    }
  }

  function save() {
    var sandwich =  JSON.stringify({
        ingredients: [
          document.getElementById('firstIngredient').value,
          document.getElementById('secondIngredient').value
        ]
      });

    //SET IN LOCAL STORAGE
    localStorage.setItem('favSandwich', sandwich);
    show();
    if(localStorage.connected) {
      push();
    }
  }

  function fetch() {
    var storageInfo = JSON.parse(localStorage.storageInfo);
    var client = remoteStorage.createClient(storageInfo, 'sandwiches', localStorage.bearerToken);
    client.get('timestamp', function(err, remoteTimestamp) {
      if(remoteTimestamp > localStorage.timestamp) {
        client.get('favSandwich', function(err, value) {
          if(value != localStorage.favSandwich) {
            localStorage.favSandwich = value;
            show();
          }
        });
      }
    });
  }
  function push() {
    var timestamp = new Date().getTime();
    var favSandwich = localStorage.favSandwich;
    var client = remoteStorage.createClient(JSON.parse(localStorage.storageInfo), 'sandwiches', localStorage.bearerToken);
    client.put('favSandwich', favSandwich, function(err) {
      client.put('timestamp', timestamp, function(err) {
        if(localStorage.favSandwich == favSandwich) {
          localStorage.timestamp = timestamp;
        } else {//raced, try again.
          push();
        }
      });
    });
  }
  function signIn() {
    document.getElementById('signIn').style.display='none';
    document.getElementById('loading').style.display='block';
    navigator.id.get(function(assertion) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/browserid-verify', true);
      xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
        //if(xhr.status == 200) {
          localStorage.loggedIn=true;
          var userAddress = JSON.parse(xhr.responseText).email;
          console.log('logging in '+userAddress);
          remoteStorage.getStorageInfo(userAddress, function(err, storageInfo) {
            localStorage.storageInfo = JSON.stringify(storageInfo);
            localStorage.oauthAddress = remoteStorage.createOAuthAddress(storageInfo, ['sandwiches'], location.protocol+'//myfavouritesandwich.org/rcvToken.html');
            document.getElementById('clickToConnect').style.display='block';
            document.getElementById('loading').style.display='none';
          });
        //} else { 
        //  error('got status '+xhr.status+' from browserid-verify');
        //}
        }
      }
      xhr.send(assertion);
    });
  }
  function doOAuth() {
    window.open(localStorage.oauthAddress);
    window.addEventListener('message', function(event) {
      if(event.origin == location.protocol +'//'+ location.host) {
        localStorage.bearerToken = event.data;
        localStorage.connected = true;
        document.getElementById('loading').style.display='none';
        document.getElementById('loggedIn').style.display='block';
        fetch();
      }
    }, false);
    document.getElementById('loading').style.display='block';
    document.getElementById('clickToConnect').style.display='none';
  }
  function logout() {
    localStorage.clear();
    document.getElementById('loggedIn').style.display='none';
    document.getElementById('signIn').style.display='block';
  }

  document.body.onload = show;
  document.getElementById('signin-button').onclick=signIn;
  document.getElementById('doOAuthButton').onclick=doOAuth;
  document.getElementById('firstIngredient').onchange=save;
  document.getElementById('firstIngredient').onkeyup=save;
  document.getElementById('secondIngredient').onchange=save;
  document.getElementById('secondIngredient').onkeyup=save;
  document.getElementById('logoutButton').onclick=logout;

  if(localStorage.loggedIn) {
    document.getElementById('loggedIn').style.display='block';
  } else {
    document.getElementById('signIn').style.display='block';
  }
  document.getElementById('loading').style.display='none';
  window.addEventListener('storage', function(key, oldValue, newValue) {
    if(key == 'loggedIn') {
      if(localStorage.loggedIn) {
        document.getElementById('loggedIn').style.display='block';
      } else {
        document.getElementById('signIn').style.display='block';
      }
    }
  });
});
