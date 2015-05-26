"use strict";

var config = require('./config.js')
  , io = require('socket.io')(config.socket_port)
  , Bleacon = require('bleacon');

var ibeaconCache = []
  , token_filter = []
  , empty = true;

function App() {
	
}

module.exports = App;

function getTokenFilter() {
  try {
  	return Homey.settings.tokens.length > 0 ? Homey.settings.tokens.replace(/\r\n/g, "\n").split("\n") : [];
  } catch(e) {
	return null;
  }
}

App.prototype.init = function() {
  ibeaconCache = [];
  token_filter = getTokenFilter() || token_filter;
  empty = true;
  
  ibeaconCache.findById = function(guid) {
	for(var i=0; i<this.length; i++) {
	  if(this[i].guid === guid) {
		return this[i];
	  }
	}
	return false
  }
  
  ibeaconCache.seen = function(guid) {
	for(var i=0; i<this.length; i++) {
	  if(this[i].guid === guid) {
		  this[i].lastseen = new Date();
	  }
	}
	return false
  }
  
  ibeaconCache.arrive = function(guid) {
  	this.push({guid: guid, lastseen: new Date()});
  }
  
  ibeaconCache.check = function() {
	var now = new Date();
	//checking which devices are left
	for(var i=ibeaconCache.length - 1; i>=0; i--) {
	  //check if the time the token was last seen exceeds the threshold
	  if(ibeaconCache[i].lastseen.getTime() + (config.leaveInterval * config.leavePolls) < now.getTime()) {
		//leaving
		Homey.log((new Date()).toLocaleTimeString() + ": " + "Leaving: " + ibeaconCache[i].guid);

		io.sockets.emit('leaving', ibeaconCache[i].guid);
		
		Homey.manager('flow').trigger('leaving', {
			'guid': ibeaconCache[i].guid
		});

		ibeaconCache.splice(i, 1);
	  }
	}

	if(ibeaconCache.length == 0 && !empty) {
	  io.sockets.emit('empty');
	  
	  Homey.manager('flow').trigger('empty', {});
	  
	  empty = true;
	}
  }
  
  ibeaconCache.discovered = function(guid, reader) {
	//check if there is a filter and if so if the guid is in the filter
	if(token_filter.length == 0 || token_filter.indexOf(guid) !== -1) {
	  Homey.log((new Date()).toLocaleTimeString() + ": " + guid);

	  io.sockets.emit('discovered', guid);

	  var dev = ibeaconCache.findById(guid);

	  if ( !!dev ) { 
		//already there
		ibeaconCache.seen(dev.guid);
	  } else {
		//arriving
		ibeaconCache.arrive(guid);
		Homey.log((new Date()).toLocaleTimeString() + ": " + "Arriving: " + guid);

		if(ibeaconCache.length == 1) {
		  io.sockets.emit('first', guid);

		  Homey.manager('flow').trigger('first', {});
		}
		io.sockets.emit('arriving', guid);

		Homey.manager('flow').trigger('arriving', {
		  'guid': ibeaconCache[i].guid
		});
	  }

	  empty = false;
	}

  }

  setInterval(ibeaconCache.check, config.leaveInterval);

  io.on('connection', function(socket){

	socket.on('register', function(name){
	  Homey.log('Reader registered with name: ' + name);
	  socket.readerName = name;
	});

	socket.on('discovered', function(guid){
	  ibeaconCache.discovered(guid, socket.readerName);
	});//end on discover


	socket.on('disconnect', function(){
	});

  });
  
  Bleacon.on('discover', function(bleacon) {
	var guid = bleacon.uuid + bleacon.major + bleacon.minor;
	Homey.log ( (new Date()).toLocaleTimeString() + ": " + guid + ":" + bleacon.uuid + "," + bleacon.major + "," +  bleacon.minor );

	ibeaconCache.discovered(guid, 'homey');
  });//end on discover

  console.log('Listening for readers on port ' + config.socket_port);
}