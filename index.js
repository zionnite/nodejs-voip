const uuid = require('uuid');

const express                           = require('express');
const {RtcTokenBuilder, RtcRole}        = require('agora-access-token');
const app                               = express();




const port              = process.env.PORT || 5000;
const APP_ID            = process.env.APP_ID || "db39e06e16f249b881979add33746d91";
const APP_CERTIFICATE   = process.env.APP_CERTIFICATE || "2239a7fa53c7478085a1d150d6d3cb27";

// console.log(APP_ID);
// console.log(APP_CERTIFICATE);

const nocache = (req, resp, next) => {
  resp.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  resp.header('Expires', '-1');
  resp.header('Pragma', 'no-cache');
  next();
}

// const generateAccessToken = (req, resp) => {
//   // set response header
//   resp.header('Acess-Control-Allow-Origin', '*');
//   // get channel name
//   const channelName = req.query.channelName;
//   if (!channelName) {
//     return resp.status(500).json({ 'error': 'channel is required' });
//   }
//   // get uid 
//   let uid = req.query.uid;
//   if(!uid || uid == '') {
//     uid = 0;
//   }
//   // get role
//   let role = RtcRole.SUBSCRIBER;
//   if (req.query.role == 'publisher') {
//     role = RtcRole.PUBLISHER;
//   }
//   // get the expire time
//   let expireTime = req.query.expireTime;
//   if (!expireTime || expireTime == '') {
//     expireTime = 3600;
//   } else {
//     expireTime = parseInt(expireTime, 10);
//   }
//   // calculate privilege expire time
//   const currentTime = Math.floor(Date.now() / 1000);
//   const privilegeExpireTime = currentTime + expireTime;
//   // build the token
//   const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
//   // return the token
//   return resp.json({ 'token': token });
// }

//app.get('/access_token', nocache, generateAccessToken);

const generateAccessToken = (data) => {
  const channelName = data.channel;

  // get uid 
  let uid = data.uid;
  if(!uid || uid == '') {
    uid = 0;
  }
  // get role
  let role = RtcRole.SUBSCRIBER;
  if (data.role == 'publisher') {
    role = RtcRole.PUBLISHER;
  }
  // get the expire time
  let expireTime = data.expireTime;
  if (!expireTime || expireTime == '') {
    expireTime = 3600;
  } else {
    expireTime = parseInt(expireTime, 10);
  }

  // console.log('channel Name',data.channel);
  // console.log('uid',data.uid);
  // console.log('role',data.role);
  // console.log('Expire',data.expireTime);
  
  // calculate privilege expire time
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;
  // build the token
  const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
  // // return the token
  return token;
}
const server          = app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
 
const io                                = require('socket.io')(server,{
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});  

/*SOCKET.IO START*/

const userMap = new Map();


io.on('connection', (socket) =>{

  onEachUserConnection(socket);  
  socket.emit('test','testing server');

});

// This function is fired when each user connects to socket
function onEachUserConnection(socket) {
	print('---------------------------------------');
	print('Connected => Socket ID ' + socket.id + ', User: ' + JSON.stringify(socket.handshake.query));

	var from_user_id = socket.handshake.query.from;
	// Add to Map
	let userMapVal = { socket_id: socket.id };
	addUserToMap(from_user_id, userMapVal);
	print(userMap);
	printNumOnlineUsers();


  connectCall(socket);
  acceptCall(socket);
  rejectCall(socket);
  hangUp(socket);
  onDisconnect(socket);
}
function addUserToMap(key_user_id, val) {
	userMap.set(key_user_id, val);
}

//Handle connect Call
function connectCall(socket){
  socket.on('connectCall',async (data) =>{



    let to_user_socket_id       = getSocketIDfromMapForthisUser(data.to);


    let userOnline = userFoundOnMap(data.to);

    if (!userOnline) {
      
      data.message = "User not Online";
      data.message_sent_status = 'STATUS_MESSAGE_NOT_SENT';
      data.to_user_online_status = false;
      socket.emit('customAlertNotifier', stringifyJson(data));
      return;
    }

    
    data.channel                = uuid.v1();
    data.expireTime             = 89000;
    data.token                  = await generateAccessToken(data);

    socket.to(to_user_socket_id).emit("onCallRequest", stringifyJson(data));
  });
}

//Handle acceptCall
function acceptCall(socket){

  socket.on('acceptCall', async (data) =>{
    data.channel                = uuid.v1();
    data.expireTime             = 89000;
    data.token                  = await generateAccessToken(data);

    print(stringifyJson(data));
    let from_user_socket_id       = getSocketIDfromMapForthisUser(data.from);
    socket.to(from_user_socket_id).emit("onAcceptCall", stringifyJson(data));
    socket.emit('goToCallPage',stringifyJson(data));
  });
}

//Handle rejectCall
function rejectCall(socket){

  socket.on('rejectCall', (data) =>{    
    let from_user_socket_id       = getSocketIDfromMapForthisUser(data.from);
    socket.to(from_user_socket_id).emit("onRejectCall", stringifyJson(data));
  });
}

//Handle rejectCall
function hangUp(socket){

  socket.on('hangUp', (data) =>{
    let to_user_socket_id       = getSocketIDfromMapForthisUser(data.to);
    socket.to(to_user_socket_id).emit("onRejectCall", stringifyJson(data));
  });
}

function onDisconnect(socket) {
	socket.on('disconnect', function () {
		print('Disconnected ' + socket.id);
		removeUserWithSocketIdFromMap(socket.id);
		socket.removeAllListeners('message');
		socket.removeAllListeners('disconnect');
	});
}

function sendBackToClient(socket, event, message) {
	socket.emit(event, stringifyJson(message));
}
  

































function getSocketIDfromMapForthisUser(to_user_id) {
	let userMapVal = userMap.get(`${to_user_id}`);
	if (userMapVal == undefined) {
		return undefined;
	}
	return userMapVal.socket_id;
}

function removeUserWithSocketIdFromMap(socket_id) {
	print('Deleting user with socket id: ' + socket_id);
	let toDeleteUser;
	for (let key of userMap) {
		// index 1, returns the value for each map key
		let userMapValue = key[1];
		if (userMapValue.socket_id == socket_id) {
			toDeleteUser = key[0];
		}
	}
	print('Deleting User: ' + toDeleteUser);
	if (undefined != toDeleteUser) {
		userMap.delete(toDeleteUser);
	}
	print(userMap);
	printNumOnlineUsers();
}

function userFoundOnMap(to_user_id) {
	let to_user_socket_id = getSocketIDfromMapForthisUser(to_user_id);
	return to_user_socket_id != undefined;
}

// Always stringify to create proper json before sending.
function stringifyJson(data) {
	return JSON.stringify(data);
}

print = (val)  => {
  console.log(val);
}

function printNumOnlineUsers() {
	print('Online Users: ' + userMap.size);
}
