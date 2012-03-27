https://myfavouritesandwich.org - an unhosted web app for demo purposes

The interface to the syncer library is as follows:

## connect
Establishes a connection with the user's remoteStorage and starts syncing.

* string userAddress - the user address (user@host) to start syncing with
* array of strings categories - the categories to start syncing, e.g. ['sandwiches']
* int pullInterval - the interval for checking if any other devices have made changes, in seconds. Default: 60
* string dialogPath - the path to the OAuth dialog. Default: '/syncer/dialog.html'
* @return: undefined

## disconnect
Pushes any pending changes to remote, and then wipes localStorage clean. Only call when the user is really leaving the device.

* cb()

## getUserAddress
* @return string userAddress of currently connected user (or undefined if there is none)

## onReadyStateChange
Called with an object when (dis)connecting and when starting/finishing a sync run.

* cb(obj) - obj will have:
  * a Boolean field 'connected' which you can use to display this info to the user.
  * a Boolean field 'syncing' which you can use to display this info to the user.

## onChange
Called with an object when changes come in.

* cb(obj) - obj will have:
  * string category
  * string key
  * string oldValue
  * string newValue
  * string timestamp

## getItem
Like with localStorage, but asynchronous.

* category
* key
* cb(err, data)

## setItem
Like with localStorage, but asynchronous.

* category
* key
* value
* cb(err, data)

## removeItem
Like with localStorage, but asynchronous.

* category
* key
* cb(err, data)

