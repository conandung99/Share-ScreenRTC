/**
 * Element Document
 */
const videoElem = document.getElementById("video");
const logElem = document.getElementById("log");
const startElem = document.getElementById("start");
const stopElem = document.getElementById("stop");
// const newRoom = document.getElementById("newRoom");

/**
 * // Declarations RTC variables
 */
var SERVER;
const httpPort = 9449;

var guest = 0, room, started = false;
var pc, connection, message, localStream;
var chanelReady = false;

// Config
var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio': true,
    'OfferToReceiveVideo': true
  }
};

// var pcConfig = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
var pcConfig = {
  iceServers: [
    {
      urls: [
        'stun:webrtcweb.com:7788'
      ],
      username: 'muazkh',
      credential: 'muazkh'
    },
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun.l.google.com:19302?transport=udp',
        'stun:numb.viagenie.ca',
        'stun:ss-turn2.xirsys.com'
      ]
    },
    {
      urls: [
        'turn:webrtcweb.com:7788', // coTURN 7788+8877
        'turn:webrtcweb.com:8877',
        'turn:webrtcweb.com:4455' // restund udp
      ],
      credential: 'muazkh',
      username: 'muazkh'
    },
    {
      urls: [
        "turn:ss-turn2.xirsys.com:80?transport=udp",
        "turn:ss-turn2.xirsys.com:3478?transport=udp",
        "turn:ss-turn2.xirsys.com:80?transport=tcp",
        "turn:ss-turn2.xirsys.com:3478?transport=tcp",
        "turns:ss-turn2.xirsys.com:443?transport=tcp",
        "turns:ss-turn2.xirsys.com:5349?transport=tcp" // restund udp
      ],
      credential: "6c9a9b2a-50b1-11e9-ae20-322c48b34491",
      username: "Hf97t7jl8yWOLiiTz2xDhEzWuaFjvETaScZfkHVyOlvAxghSQLcw6mSKrKxwnnk3AAAAAFybq4Fjb25hbmR1bmc5OQ=="
    },
    {
      url: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com'
    }
  ]
};

var pcConstraints = { "optional": [{ "DtlsSrtpKeyAgreement": true }] };
var offerConstraints = { "optional": [], "mandatory": {} };

// Options for getDisplayMedia()
var displayMediaOptions = {
  video: {
    aspectRatio: 1920 / 1080,
    cursor: "never",
    frameRate: { ideal: 24, max: 60 }
  },
  audio: false
};

/*
 Init 
*/
function init() {
  console.log("Wellcome!");
  var room = window.location.hash.slice(1);
  console.log("room is: " + room);
  SERVER = window.location.origin.replace(/^http/,'ws');

  openChannel();

  // Set event listeners for the start and stop buttons
  // newRoom.addEventListener("click", function(evt) {
  //   console.log("create Room!");
  //   initNewRoom();
  // }, false);

  startElem.addEventListener("click", function (evt) {
    startCapture();
  }, false);

  stopElem.addEventListener("click", function (evt) {
    stopCapture();
  }, false);

  // console.log = msg => logElem.innerHTML += `<br>${msg}<br>`;
  console.error = msg => logElem.innerHTML += `<span class="error">${msg}</span><br>`;
  console.warn = msg => logElem.innerHTML += `<span class="warn">${msg}<span><br>`;
  console.info = msg => logElem.innerHTML += `<span class="info">${msg}</span><br>`;
}

async function startCapture() {
  logElem.innerHTML = "";

  try {
    videoElem.srcObject = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    // navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
    // .then(stream => {
    //   localStream = stream;
    //   videoElem.srcObject = stream;
    // });
    maybeStart();
    dumpOptionsInfo();
  } catch (err) {
    console.error("Error: " + err);
  }
}

function stopCapture(evt) {
  let tracks = videoElem.srcObject.getTracks();

  tracks.forEach(track => track.stop());
  videoElem.srcObject = null;
}

function dumpOptionsInfo() {
  localStream = videoElem.srcObject;
  const videoTrack = videoElem.srcObject.getVideoTracks()[0];

  console.warn("TRACK SETTINGS:");
  console.info(JSON.stringify(videoTrack.getSettings(), null, 2));
  console.warn("TRACK CONSTRAINTS:");
  console.info(JSON.stringify(videoTrack.getConstraints(), null, 2));
}

function initNewRoom() {
  if (!location.hash.replace('#', '').length) {
    location.href = location.href.split('#')[0] + '#' + (Math.random() * 100).toString().replace('.', '');
    location.reload();
  }
}

/**
 *    WEBRTC INITINAZING.......
 */
function openChannel () {
  console.log('Connect to websocket: ' + SERVER + ':' + httpPort + '/');
  connection = new WebSocket(SERVER + + ':' + httpPort + '/');
  // connection = new WebSocket('ws://localhost:9449/');
  
  // When connection open -> send some data to the server
  connection.onopen = onChannelOpened;

  // Log errors
  connection.onerror = function (error) {
    console.log('WebSocket Error ' + error);
  };

  connection.onmessage = onChannelMessage;
  connection.onclose = onChannelClosed;
}

/**
 * Called when the channel with the server is opened
 * if are guest -> call
 * @return void
 */
function onChannelOpened() {
  console.log('Channel Openend: ' + guest);
  if(!guest) {
    message = JSON.stringify({"type" : "GETROOM", "value" : room});
    console.log(message);
    connection.send(message);
  }
  else {
    // Create message -> server to request connection with broadcast
    message = JSON.stringify({"type" : "INVITE", "value" : room});
    console.log(message);
    connection.send(message);
  }
  maybeStart();
}

/**
 * log that the channel is closed
 * @return {[type]}
 */
onChannelClosed = function() {
  console.log('Channel closed.');
};

/**
 * Called when the client receive a message from the websocket server
 * @param  {message} message : SDP message
 * @return {void}
 */
onChannelMessage = function(message) {
    message = JSON.parse(message.data);
    console.log(message);
    console.log('S->C: ' + message["value"]);

    switch(message["type"]) {
      case "GETROOM" :
        guest = message["value"];
        console.log('GUEST: ' + guest);
        // resetStatus();
        if(guest) {
          onChannelOpened();
        }
      break;
      case "candidate" :
        var candidate = new RTCIceCandidate({
                                              sdpMLineIndex:message.label,
                                              candidate:message.candidate
                                            });

	 pc.addIceCandidate(candidate);

      break;
      case "offer" :

      // Callee creates PeerConnection
      if (!guest && !started)
        maybeStart();

        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
      break;
      case "answer" :
        pc.setRemoteDescription(new RTCSessionDescription(message));
      break;
      case "BYE" :
        onChannelBye();
      break;
    }
};

/**
 * Called when the other client is leaving
 * @return {void}
 */
onChannelBye = function() {
  console.log('Session terminated.');
  remoteVideo.css("opacity", "0");
  $("#remotelive").addClass('hide');
  //remoteVideo.attr("src",null);
  guest = 0;
  started = false;
  setStatus("<div class=\"alert alert-info\">Your partner have left the call.</div>");
};
/**
 * Set parameter for creating a peer connection and add a callback function for messagin by peer connection
 * @return {void}
 */
createPeerConnection = function() {
  console.log('Create PeerConnection');
  try {
    // Create an RTCPeerConnection via the polyfill (adapter.js).
    // pc = new RTCPeerConnection(pcConfig, pcConstraints);
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = onIceCandidate;
    console.log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pcConfig) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pcConstraints) + '\'.');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object; WebRTC is not supported by this browser.');
    return;
  }

  pc.onaddstream = onRemoteStreamAdded;
  pc.onremovestream = onRemoteStreamRemoved;
};

/**
 * Function called by the peerConnection method for the signaling process between clients
 * @param  {message} message : generated by the peerConnection API to send SDP message
 * @return {void}
 */
 onSignalingMessage = function(message) {
  console.log("onSignalingMessage " + message);
  message = JSON.stringify(message);
  connection.send(message);
};

maybeStart = function() {
  console.log('Start Initing RTC.....');
  console.log("Creating PeerConnection.");
  createPeerConnection();
  console.log("Adding local stream.");
  if (!guest && localStream)
    pc.addStream(localStream);
  // if (guest)
    doCall();
};

doCall = function () {
  var constraints = mergeConstraints(offerConstraints, sdpConstraints);
     console.log('Sending offer to peer, with constraints: \n' +
                 '  \'' + JSON.stringify(constraints) + '\'.');
     // pc.createOffer(setLocalAndSendMessage, null, constraints);
     pc.createOffer(constraints).then(function(offer) {
       return setLocalAndSendMessage(offer);
     });
 };
 
 doAnswer = function () {
   console.log("Sending answer to peer.");
   // pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
   pc.createAnswer(sdpConstraints).then(function(answer) {
     return setLocalAndSendMessage(answer);
   });
 };
 
 mergeConstraints = function (cons1, cons2) {
   var merged = cons1;
   for (var name in cons2.mandatory) {
     merged.mandatory[name] = cons2.mandatory[name];
   }
   merged.optional.concat(cons2.optional);
   return merged;
 };
 
 setLocalAndSendMessage = function (sessionDescription) {
   // Set Opus as the preferred codec in SDP if Opus is present.
   sessionDescription.sdp = preferOpus(sessionDescription.sdp);
   pc.setLocalDescription(sessionDescription);
   onSignalingMessage(sessionDescription);
 };
 /**
  * STREAM SEND / RECIEVE =============
  */

/**
 * Get the remote stream and add it to the page with an url
 * @param  {event} event : event given by the browser
 * @return {void}
 */
 onRemoteStreamAdded = function(event) {
  console.log("Remote stream added.");
  // attachMediaStream(remoteVideo[0], event.stream);
  videoElem.srcObject = event.stream;
};

/**
 * Called when the remote stream has been removed
 * @param  {event} event : event given by the browser
 * @return {void}
 */
onRemoteStreamRemoved = function(event) {
  console.log("Remote stream removed.");
};
 /**
  * /////////================
  */

/**
 *  ICE + SDP Creating.....
 */
/**
 * Called when the peer connection is connecting
 * @param  {message} message
 * @return {void}
 */
onSessionConnecting = function(message) {
  console.log("Session connecting.");
};

/**
 * Called when the session between clients is established
 * @param  {message} message
 * @return {void}
 */
 onSessionOpened = function(message) {
  console.log("Session opened.");
    // Caller creates PeerConnection.
    if (guest) maybeStart();
  };

/**
 *  ICE
 */

onIceCandidate = function(event) {
  if (event.candidate) {
    onSignalingMessage({type: 'candidate',
     label: event.candidate.sdpMLineIndex,
     id: event.candidate.sdpMid,
     candidate: event.candidate.candidate});
  } else {
    console.log("End of candidates.");
  }
};

// Set Opus as the default audio codec if it's present.
preferOpus = function (sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex = null;

  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null)
    return sdp;

  // If Opus is available, set it as the default in m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload)
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
};

extractSdp = function (sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return (result && result.length == 2)? result[1]: null;
};

// Set the selected codec to the first in m line.
setDefaultCodec = function (mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    if (elements[i] !== payload)
      newLine[index++] = elements[i];
  }
  return newLine.join(' ');
};

// Strip CN from sdp before CN constraints is ready.
removeCN = function (sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length-1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
};

// module.exports = init;