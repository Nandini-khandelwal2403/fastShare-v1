const socket = io.connect();
let pc = {};
let dataChannel = {};
let p2p_flag = {};

window.onload = function() {
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
    console.log("Room Created of size", roomSize);
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

    pc[roomid].oniceconnectionstatechange = function(event) {
        if (pc[roomid].iceConnectionState === "failed" ||
            pc[roomid].iceConnectionState === "disconnected" ||
            pc[roomid].iceConnectionState === "closed") {} else if (pc[roomid].iceConnectionState === "connected") {}
    };


    if (isOfferer) {
        // If user is offerer let them create a negotiation offer and set up the data channel
        console.log('Offering call');
        pc[roomid].onnegotiationneeded = () => {
            pc[roomid].createOffer((desc) => localDescCreated(roomid, desc), error => console.error(error));
        }
        dataChannel[roomid] = pc[roomid].createDataChannel('fastShare-v1');
        dataChannel[roomid].binaryType = "arraybuffer";
        setupDataChannel(roomid);
    } else {
        // If user is not the offerer let wait for a data channel
        console.log('waiting for call');
        pc[roomid].ondatachannel = event => { // when offerer will come then set datachannel
            console.log('DC set up');
            dataChannel[roomid] = event.channel;
            dataChannel[roomid].binaryType = "arraybuffer";
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

let receiveBuffer = {};
let receivedSize = {};

// Hook up data channel event handlers
async function setupDataChannel(roomid) {
    checkDataChannelState(roomid);
    dataChannel[roomid].onopen = () => checkDataChannelState(roomid);
    dataChannel[roomid].onclose = () => checkDataChannelState(roomid);
    dataChannel[roomid].onmessage = async(event) => {

        let fileObj = JSON.parse(event.data)
        let ab = new Uint8Array(fileObj.data).buffer;
        if (!receiveBuffer[fileObj.uuid]) {
            receiveBuffer[fileObj.uuid] = [];
            receivedSize[fileObj.uuid] = { value: 0, max: fileObj.size };
            const template = document.querySelector('template[data-template="file-template"]')
            let clone = template.content.cloneNode(true);
            clone.querySelector('.card').id = fileObj.uuid;
            clone.querySelector('.card-title').id = 'title-' + fileObj.uuid;
            clone.querySelector('.card-text').id = 'text-' + fileObj.uuid;
            clone.querySelector('.progress-bar').id = 'progress-' + fileObj.uuid;
            clone.querySelector('.card-title').innerHTML = fileObj.name;
            clone.querySelector('.card-text').innerHTML = 'Receiving from ' + fileObj.peer;
            clone.querySelector('.progress-bar').style.width = '0%'
            document.querySelector('.files-list').appendChild(clone.querySelector('.card'));
        }
        receiveBuffer[fileObj.uuid].push(ab);
        receivedSize[fileObj.uuid].value += ab.byteLength;
        document.querySelector("#progress-" + fileObj.uuid).style.width = receivedSize[fileObj.uuid].value / receivedSize[fileObj.uuid].max * 100 + "%";

        if (receivedSize[fileObj.uuid].value === receivedSize[fileObj.uuid].max) {
            document.querySelector('#text-' + fileObj.uuid).innerHTML = "Received from " + fileObj.peer;
            document.querySelector('#title-' + fileObj.uuid).innerHTML += "&nbsp" + '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/></svg>'

            const received = new Blob(receiveBuffer[fileObj.uuid]);
            receiveBuffer[fileObj.uuid] = [];
            let a = document.createElement("a");
            a.href = URL.createObjectURL(received);
            a.download = fileObj.name;
            a.click();


        }
    }

}

function checkDataChannelState(roomid) {
    console.log('WebRTC channel state is:', dataChannel[roomid].readyState);
    if (dataChannel[roomid].readyState === 'open') { //means both peer connected
        p2p_flag[roomid] = true; //peer is online
    } else if (dataChannel[roomid].readyState === 'closed') { //means one goes offline
        p2p_flag[roomid] = false;
        dataChannel[roomid].close();
        dataChannel[roomid] = null;
        startWebRTC(false, roomid); //it will wait for the other peer to come and offer call
    }
}

let allFiles = {};
let torrentURIlist = [];
let filesProgress = {};
const files_input = document.getElementById('files-input');
files_input.addEventListener('input', (e) => {
    const files = Array.from(e.target.files);
    console.log(files);
    files.forEach(file => {
        const uuid = uuidv4();
        allFiles[file.name] = { uuid: uuid, file: file };

        const template = document.querySelector('template[data-template="file-template"]')
        let clone = template.content.cloneNode(true);
        clone.querySelector('.card').id = uuid;
        clone.querySelector('.card-title').id = 'title-' + uuid;
        clone.querySelector('.card-text').id = 'text-' + uuid;
        clone.querySelector('.progress-bar').id = 'progress-' + uuid;
        clone.querySelector('.card-title').innerHTML = file.name;
        clone.querySelector('.card-text').innerHTML = 'Sending to everyone'
        clone.querySelector('.progress-bar').style.width = '0%'
        document.querySelector('.files-list').appendChild(clone.querySelector('.card'));

    });

    document.querySelector('.send-file-btn').disabled = false;
})

const send = document.querySelector('.send-file-btn')
send.addEventListener('click', (e) => {
    e.preventDefault();



    // send file using data channel
    Object.keys(allFiles).forEach(key => {
        let fileReader;
        let fileObj = allFiles[key];
        let uuid = fileObj.uuid;
        let file = fileObj.file;
        console.log(`File is ${[file.name, file.size, file.type, file.lastModified].join(' ')}`);
        let sendProgress = document.querySelector("#progress-" + uuid);
        sendProgress.max = file.size;
        // receiveProgress.max = file.size;
        const chunkSize = 16384;
        fileReader = new FileReader();
        let offset = 0;
        fileReader.addEventListener('error', error => console.error('Error reading file:', error));
        fileReader.addEventListener('abort', event => console.log('File reading aborted:', event));
        fileReader.addEventListener('load', e => {
            console.log('FileRead.onload ', e);
            dataChannel[roomID].send(JSON.stringify({ uuid: uuid, name: file.name, size: file.size, peer: username, data: Array.from(new Uint8Array(e.target.result)) }));
            offset += e.target.result.byteLength;
            sendProgress.style.width = offset / sendProgress.max * 100 + "%";
            if (offset < file.size) {
                readSlice(offset);
            }
        });
        const readSlice = o => {
            console.log('readSlice ', o);
            const slice = file.slice(offset, o + chunkSize);
            fileReader.readAsArrayBuffer(slice);
        };
        readSlice(0);
    });

    send.disabled = true;
})

socket.on("message", (message, roomid) => {
    // if (message.type === "offer" || message.type === "answer" || message.candidate) {
    console.log('Client receiving message: ', message, roomid);
    // }
    if (message.type === "offer") {
        // This is called after receiving an offer or answer from another peer
        pc[roomid].setRemoteDescription(new RTCSessionDescription(message), () => {
            console.log('pc.remoteDescription.type', pc[roomid].remoteDescription.type);
            console.log('Answering offer');
            pc[roomid].createAnswer((desc) => localDescCreated(roomid, desc), error => console.error(error));
            console.log("Answer created");
        }, error => console.error(error));
    } else if (message.type === "answer") {
        console.log("Answer came");
        pc[roomid].setRemoteDescription(new RTCSessionDescription(message));

    } else if (message.candidate) {
        // Add the new ICE candidate to our connections remote description
        console.log('candidate');
        pc[roomid].addIceCandidate(new RTCIceCandidate(message));
    }
})

function sendMessage(message, room) {
    if (message.type === "offer" || message.type === "answer" || message.candidate) {
        console.log('Client sending message: ', message.type, room);
    }
    socket.emit('message', message, room);
}