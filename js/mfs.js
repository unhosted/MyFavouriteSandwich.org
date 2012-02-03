
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
  var storageAddresses = JSON.parse(localStorage.storageAddresses);
  var client = remoteStorage.createClient(storageAddresses.sandwiches, localStorage.api, localStorage.oauthToken);
  client.get('timestamp', function(remoteTimestamp) {
    if(remoteTimestamp > localStorage.timestamp) {
      client.get('favSandwich', function(value) {
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
  var storageAddresses = JSON.parse(localStorage.storageAddresses);
  var client = remoteStorage.createClient(storageAddresses.sandwiches, localStorage.api, localStorage.oauthToken);
  client.set('favSandwich', favSandwich, function() {
    client.set('timestamp', timestamp, function() {
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
        require(['js/unhosted/remoteStorage'], function(remoteStorage) {
          remoteStorage.getInfo(userAddress, ['sandwiches'], 'https://myfavouritesandwich.org/rcvToken.html', function(api, OAuthAddress, storageAddresses) {
            localStorage.storageAddresses = JSON.stringify(storageAddresses);
            localStorage.api = api;
            window.addEventListener('storage', function(key, oldValue, newValue) {
              if(key == 'oauthToken') {
                localStorage.connected = true;
                fetch();
                push();
              }
            });
            window.open(OAuthAddress);
            document.getElementById('loggedIn').style.display='block';
            document.getElementById('loading').style.display='none';
          });
        });
      //} else {
      //  error('got status '+xhr.status+' from browserid-verify');
      //}
      }
    }
    xhr.send(assertion);
  });
}
function logout() {
  localStorage.clear();
  document.getElementById('loggedIn').style.display='none';
  document.getElementById('signIn').style.display='block';
}

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
