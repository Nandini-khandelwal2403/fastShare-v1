const socket = io.connect();
let pc = {};
let dataChannel = {};

window.onload = function(){
    const roomID = location.pathname.substring(location.pathname.length - 4);
    console.log(roomID);
    window.roomID = roomID;
    document.querySelector('.roomID').innerText += roomID;
    const username = prompt("Give Username: ");
    socket.emit('joinroom', username, roomID);
    window.username = username;
    window.socket = socket;
    console.log("Generate Room");
}

let peers = {};
socket.on("updateRoom", (newPeer, roomSize, newPeerID) => {
    window.roomSize = roomSize;
    console.log("Room Created");
    const isOfferer = roomSize > 1;
    console.log('trigger');
    startWebRTC(isOfferer, roomID);
    console.log("data channel");
    // if (newPeer !== username) {
    //     peers[newPeer] = newPeerID;
    //     chart.series[0].addPoint([username, newPeer], true);
    // }

})

const configuration = {
    iceServers: [{
        url: 'stun:stun.l.google.com:19302'
    },
    {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
    },
    {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject"
    },
    {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject"
    }
    ],
    // iceCandidatePoolSize: 2
};


function startWebRTC(isOfferer, roomid) { //2nd person is offerer
    console.log('Starting WebRTC in as', isOfferer ? 'offerer' : 'waiter');
    // if (isOfferer) {
    //     sendSignalingMessage({ start: 'true' });
    // }
    pc[roomid] = new RTCPeerConnection(configuration);

    // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
    // message to the other peer through the signaling server
    pc[roomid].onicecandidate = event => {
        if (event.candidate) {
            console.log('new candy');
            sendMessage(event.candidate, roomid);
        }
    };

    pc[roomid].oniceconnectionstatechange = function (event) {
        if (pc[roomid].iceConnectionState === "failed" ||
            pc[roomid].iceConnectionState === "disconnected" ||
            pc[roomid].iceConnectionState === "closed") { } else if (pc[roomid].iceConnectionState === "connected") { }
    };


    if (isOfferer) {
        // If user is offerer let them create a negotiation offer and set up the data channel
        console.log('Offering call');
        pc[roomid].onnegotiationneeded = () => {
            pc[roomid].createOffer((desc) => localDescCreated(roomid, desc), error => console.error(error));
        }
        dataChannel[roomid] = pc[roomid].createDataChannel('fastShare-v1');
        setupDataChannel(roomid);
    } else {
        // If user is not the offerer let wait for a data channel
        console.log('waiting for call');
        pc[roomid].ondatachannel = event => { // when offerer will come then set datachannel
            console.log('DC set up');
            dataChannel[roomid] = event.channel;
            setupDataChannel(roomid);
        }
    }

    // startListentingToSignals();
}

function localDescCreated(roomid, desc) {
    pc[roomid].setLocalDescription(
        desc,
        () => sendMessage(pc[roomid].localDescription, roomid), // sending desc
        error => console.error(error)
    );
}


socket.on("message", (message, roomid) => {
    console.log(message);
    if (message.type === "offer") {
        // This is called after receiving an offer or answer from another peer
        pc[roomid].setRemoteDescription(new RTCSessionDescription(message), () => {
            console.log('pc.remoteDescription.type', pc[roomid].remoteDescription.type);
            console.log('Answering offer');
            pc[roomid].createAnswer((desc) => localDescCreated(roomid, desc), error => console.error(error));
        }, error => console.error(error));
    } else if (message.type === "answer") {
        pc[roomid].setRemoteDescription(new RTCSessionDescription(message));

    } else if (message.candidate) {
        // Add the new ICE candidate to our connections remote description
        console.log('candidate');
        pc[roomid].addIceCandidate(new RTCIceCandidate(message));
    } 
})

function sendMessage(message, room) {
    // console.log('Client sending message: ', message, room);
    socket.emit('message', message, room);
}


