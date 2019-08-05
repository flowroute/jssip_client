
var fr_version = "0.1.2";
function fr_get_version () {
	return fr_version;
}

var font_family = 'Verdana, "Bitstream Vera Sans", "DejaVu Sans", Tahoma, Geneva, Arial, Sans-serif';

// alternative to Jquery
function fr_get_script(source, callback) {
	var script = document.createElement('script');
	var prior = document.getElementsByTagName('script')[0];
	script.async = 1;

	script.onload = script.onreadystatechange = function( _, isAbort ) {
		if(isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
			script.onload = script.onreadystatechange = null;
			script = undefined;
			if(!isAbort && callback) setTimeout(callback, 0);
		}
	};
	script.src = source;
	prior.parentNode.insertBefore(script, prior);
}

function ready(callback){
	// in case the document is already rendered
	if (document.readyState!='loading') callback();
	// modern browsers
	else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback);
	// IE <= 8
	else document.attachEvent('onreadystatechange', function(){
		if (document.readyState=='complete') callback();
	});
}

function fr_init_language() {
	var language = navigator.language || navigator.userLanguage;
	var lang = language.substring(0,2);
	fr.msg = fr_msg_en;
	$("#fr_bt_call").html(fr.msg.call);

}

var fr_msg_en = {
	answer: "answer",
	call: "call",
	cancel: "cancel",
	disconnect: "disconnect",
	directory: "directory",
	error_no_agent: "We are sorry there are no chat agents available right now, please try again later.",
	send: "send",
	clear: "clear",
	waiting: "waiting",
	welcome: "welcome",
	me: "me"
};

var fr_params = {
	did : null,
	pop : "us-east-nj",
	callerid : "anonymous",
	display_name : null,
	password : "nopassword",
	xheaders : [],
	debug : false,
	user_muted : false,
	user_volume : 50
};

class Flowroute {
	constructor() {
		this.session_manager = null;
		this.registration = 0;
		this.active_session = 0;
		this.rtc_session = null;
		this.msg = null;
		this.update_status = function () {return};
		this.params = fr_params;
	}
}

var fr_es = { "us-east-nj": [ "staging-ep-us-west-or-01.fl.gg", "preprod-ep-us-east-nj-01.fl.gg" ],
              "us-west-or": [ "preprod-ep-us-east-nj-01.fl.gg", "staging-ep-us-west-or-01.fl.gg" ] };

class FrQOS {
	constructor() {
		this.rtp_rx = null;
		this.rtp_tx = null;
		this.media_rx = null;
		this.media_tx = null;
		this.version = 0.1;
		this.callid = null;
		this.active = false;
		this.interval = 5000;
	}
	add(data) {
		if (data.id && data.id.includes("inbound_rtp_audio"))
			this.rtp_rx = data;
		else if (data.id && data.id.includes("outbound_rtp_audio"))
			this.rtp_tx = data
		else if (data.id && data.id.includes("RTCOutboundRTPAudioStream"))
			this.rtp_tx = data
		else if (data.id && data.id.includes("RTCInboundRTPAudioStream"))
			this.rtp_rx = data
		else if (data.id && data.id.includes("RTCMediaStreamTrack_receiver"))
			this.media_rx = data
		else if (data.id && data.id.includes("RTCMediaStreamTrack_sender"))
			this.media_tx = data
		this.send_report();
	}
	send_report() {
		if (this.rtp_rx && this.rtp_tx) {
			var rpt = { 'qos_data': { 'tx': this.rtp_tx, 'rx': this.rtp_rx }};
			if (this.media_tx)
				rpt['qos_data']['tx_media'] = this.media_tx;
			if (this.media_rx)
				rpt['qos_data']['rx_media'] = this.media_rx;
			var to = fr.params.did + "@sip.flowroute.com";
			var options = { 'extraHeaders': [ 'P-QoS-Call-ID:'+this.callid ] };
			fr.jssip_ua.sendMessage(to, JSON.stringify(rpt, null, 2), options);
			this.rtp_rx = null;
			this.rtp_tx = null;
			this.media_rx = null;
			this.media_tx = null;
		}
	}
	start(pc) {
		this.active = true;
		_getstats(pc);
	}
	stop() {
		this.active = false;
	}
}

function _getstats(pc) {
	_getstats_real(pc, function (results) {
		for (var i = 0; i < results.length; ++i) {
			var res = results[i];
			console.log(res);
			fr_qos.add(res);
		}
		if (!fr_qos.active)
			return;
		setTimeout(function () {
			_getstats(pc);
		}, fr_qos.interval);
	});
}

function _getstats_real(pc, callback) {
	// no argument, considered promise-based getStats()
	if (pc.getStats.length === 0) {
		pc.getStats().then(function (res) {
			var items = []
			if (res === null) return;
			res.forEach(function (item) {
				items.push(item)
			})
			callback(items);
		}, function (err) { console.log(err) });
	}
	// one or more arguments callback-based getStats() (firefox)
	else if (conn.getStats.length > 0) {
		pc.getStats(function (res) {
			var items = [];
			res.result().forEach(function (result) {
				var item = {};
				result.names().forEach(function (name) {
				item[name] = result.stat(name);
				});
				item.id = result.id;
				item.type = result.type;
				item.timestamp = result.timestamp;
				items.push(item);
			});
			callback(items);
		});
	}
}

var fr = new Flowroute();
var fr_qos = new FrQOS();

function fr_jssip_start(){
	var socket1 = new JsSIP.WebSocketInterface('wss://'+ fr_es[fr.params.pop][0] +':4443');
	var socket2 = new JsSIP.WebSocketInterface('wss://'+ fr_es[fr.params.pop][1] +':4443');
	var sockets = [{socket: socket1, weight: 10}, {socket: socket2, weight: 10}];
	var configuration = {
		sockets  : sockets,
		uri: 'sip:'+fr.params.callerid+'@wss.flowroute.com',
		password: fr.params.password,
		display_name: fr.params.display_name
	};
	fr.jssip_ua = new JsSIP.UA(configuration);
	fr.jssip_ua.start();
}

function fr_jssip_restart(){
	fr.jssip_ua.stop();
	fr_jssip_start();
}

function fr_init(){
	var d = new Date();
	var hour = (d.getHours()<10?'0':'') + d.getHours();
	var min = (d.getMinutes()<10?'0':'') + d.getMinutes();
	var sec = (d.getSeconds()<10?'0':'') + d.getSeconds();
	var ms = d.getMilliseconds();
	var tuid = "-"+hour+min+sec+"."+ms;
	if (fr.params.debug) {
		JsSIP.debug.enable('JsSIP:*');
	} else {
		JsSIP.debug.disable('JsSIP:*');
	}
	fr_jssip_start();
}

function fr_set_cookie(cname, cvalue, exdays) {
	var d = new Date();
	d.setTime(d.getTime() + (exdays*24*60*60*1000));
	var expires = "expires="+d.toUTCString();
	document.cookie = cname + "=" + cvalue + "; " + expires;
}

function fr_get_cookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for(var i=0; i<ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1);
		if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
	}
	return "";
}

function fr_load(params){
	fr_validate_params(params);
	fr_load_jssip();
}

function fr_load_jssip(){
	fr_get_script("https://media.castmm.com/include/cmm/fr/lib/jssip-3.3.6.js", function(){fr_load_jquery();});
}

var fr_es = { "us-east-nj": [ "staging-ep-us-west-or-01.fl.gg", "preprod-ep-us-east-nj-01.fl.gg" ],
              "us-west-or": [ "preprod-ep-us-east-nj-01.fl.gg", "staging-ep-us-west-or-01.fl.gg" ] };

function fr_add_header(hname, hvalue) {
	if (hname.length == 0 || hvalue.length == 0)
		return;
	var header = "P-"+hname+": "+hvalue;
	fr.params.xheaders.push(header)
	fr_wcons("adding header["+header+"]");
}

function fr_validate_did(did) {
	try {
		if (typeof did === 'undefined')
			throw "required param did missing";
		if (did.length != 11)
			throw "required param did invalid: " + did;
		fr.params.did = did;
	} catch (e) {
		fr_wcons(e);
		throw new Error(e);
	}
	return;
}

function fr_set_param(name, value) {
	if (name === "debug" &&  value) {
		fr.params.debug = true;
	} else if (name === "did") {
		fr_validate_did(value);
	} else if (name === "callerid") {
		fr.params.callerid = value;
	} else if (name === "qos_report_interval") {
		if (value > 1000 && value < 60000)
			fr_qos.interval = value;
	}
	fr_wcons("set_param["+name+"="+header+"]");
}

function fr_validate_params(params) {
	fr_validate_did(params['did']);
	if (typeof params['pop'] !== 'undefined' && typeof fr_es[params['pop']] !== 'undefined') {
		fr.params.pop = params['pop'];
	}
	if (typeof params['display_name'] !== 'undefined') {
		fr.params.display_name = params['display_name'];
	}
	if (typeof params['callerid'] !== 'undefined') {
		fr.params.callerid = params['callerid'];
	}
	if (typeof params['debug'] !== 'undefined') {
		if (params['debug'] == true)
			fr.params.debug = true;
	}
}

function fr_init_modules() {
	fr_init_language();
	fr_set_font();
	fr_wcons("audio_init ...");
	fr_audio_init();
}

function fr_load_init(){
	fr_wcons("JSSIP_client:" + fr_get_version());
	fr_wcons("jquery:" + jQuery.fn.jquery);
	fr_wcons("JSSIP:" + JsSIP.version);
	fr_wcons("params.debug:"+fr.params.debug);
	fr_wcons("params.pop:"+fr.params.pop);
	fr_wcons("params.callerid:"+fr.params.callerid);
	fr_wcons("params.did:"+fr.params.did);
	fr_init_modules();
	fr_init();
	fr_wcons("JSSIP UA init ...");
	fr_jssip_ua_init(fr.jssip_ua);
}

function fr_load_jquery(){
	if (typeof jQuery === 'undefined' || jQuery === null ){
		fr_get_script("https://media.castmm.com/include/cmm/fr/lib/jquery-3.4.1.min.js", function(){fr_load_init();});
	}
}

/* logging console */
function fr_wcons(msg){
	if($('#fr_debug_console').text() == ''){
		$('#fr_debug_console').text(msg);
	} else {
		$('#fr_debug_console').text($('#fr_debug_console').text()+'\n'+msg);
		$('#fr_debug_console').scrollTop($('#fr_debug_console')[0].scrollHeight);
	}
}

function fr_set_font(){
	$('#fr_debug_console').css("font-family", 'Courier');
	$('#fr_debug_console').css("font-size", '10px');
}

function fr_get_cookie(key) {
	var keyValue = document.cookie.match('(^|;) ?' + key + '=([^;]*)(;|$)');
	return keyValue ? keyValue[2] : null;
}

function fr_play_ring(){
	//fr.sound_player.play();
}

function fr_stop_ring(){
	//if(fr.sound_player === 'undefined'){return;}
	//fr.sound_player.pause();
	//if(fr.sound_player.currentTime != 0){fr.sound_player.currentTime = 0;}
}

function fr_set_mute(muted){
	fr.audio_player.defaultMuted = muted;
	fr.params.user_muted = muted;
	fr_wcons("set_muted:"+muted);
}

function fr_set_volume(val){
	fr_wcons('['+val+']Before: ' + fr.audio_player.volume);
	fr.audio_player.volume = Math.max(0, Math.min(1, val/100));
	fr_wcons('After: ' + fr.audio_player.volume);
}

function fr_set_volume(val){
	if (val <  0 || val > 100)
		fr.params.user_volume = 50;
	else
		fr.params.user_volume = val;
	fr_wcons("set_volume:"+fr.audio_player.volume+" >> "+ Math.max(0, Math.min(1, fr.params.user_volume/100)));
	fr.audio_player.volume = Math.max(0, Math.min(1, fr.params.user_volume/100));
}

function fr_audio_init(){
	fr.audio_player = document.createElement("audio");
	fr.audio_player.volume = 0.5
	if (!fr.params.user_muted)
		fr.audio_player.defaultMuted = false;
	fr.audio_player.autoplay = true;
	fr.audio_player.controls = true;
}

function fr_audio_connect(e) {
	ssrc_tx = null
	fr_qos.start(fr.rtc_session.connection);
	fr.audio_player.srcObject = fr.rtc_session.connection.getLocalStreams()[0];
	fr.audio_player.srcObject = fr.rtc_session.connection.getRemoteStreams()[0];
	fr.audio_player.volume = fr.params.user_volume / 100;
	fr_wcons("audio connected");
	if (!fr.params.user_muted)
		fr.audio_player.defaultMuted = false;
}

function fr_audio_disconnect() {
	fr_qos.stop();
	fr.audio_player.defaultMuted = true;
	fr_wcons("audio disconnected");
}

function fr_jssip_ua_init(){
	fr.jssip_ua.on('registered', function(e){
		fr_wcons("registered");
		if(fr.registration == 1)
			return;
		fr.registration = 1;
		$("#fr_bt_call").unbind("click");
		$("#fr_bt_call").click(function() {fr_session_makecall()});
		fr_wcons('registered');

	fr.jssip_ua.on('unregistered', function(e){
		fr_wcons('unregister');
	});
	fr.jssip_ua.on('registrationFailed', function(e){
		fr_wcons('registration failed');
	});
	fr.jssip_ua.on('connected', function(e){
		fr_wcons('connected');
	});
	fr.jssip_ua.on('disconnected', function(e){
		fr_wcons('disconnected');
	});
	fr.jssip_ua.on('newMessage', function(e){
		fr_wcons('new message');
		if(e.data){
			if(e.data.originator == 'remote'){rcv_msg(e)};
		}
	});
	fr.jssip_ua.on('newRTCSession', (data) => {
		fr_wcons('new RTC session');
		var display_name;
		var request = data.request;
		fr_qos.callid = request.call_id;
		fr_wcons("call-id:"+request.call_id);
		var session = data.session;
		fr.rtc_session = session;
		var uri = session.remote_identity.uri;

		display_name = session.remote_identity.display_name || session.remote_identity.uri.user;
		if (session.direction == 'incoming') {
			fr_wcons('incoming');
			if (fr.active_session) {fr_session_busy(session)}
			else {fr_session_incoming(session,request)}
		} else if (session.direction == 'outgoing'){
			fr_wcons('call: trying');
			fr_session_trying(session);
		}
		session.on('progress', () => {
			fr_wcons('call: progressing');
			fr_session_progress(this);
		});
		session.on('ended', () => {
			fr_audio_disconnect();
			fr_stop_ring();
			fr.active_session=0;
			fr_wcons('ended');
			$("#fr_bt_call").html(fr.msg.call);
			$("#fr_bt_call").unbind("click");
			$("#fr_bt_call").click(function() {fr_session_makecall()});
		});
		session.on('started', () => {
			fr_stop_ring();
			fr_session_established(e);
		});
		session.on('accepted', (data) => {
			fr_wcons('call: accepted');
			fr_stop_ring();

		});
		session.on('confirmed', (data) => {
			fr_wcons('call: confirmed');
			fr_session_established(data);
		});
		session.on('failed', (data) => {
			fr_stop_ring();
			fr.active_session=0;
			fr_wcons('call: failed('+data.cause+')');
			$("#fr_bt_call").html(fr.msg.call);
			$("#fr_bt_call").unbind("click");
			$("#fr_bt_call").click(function() {fr_session_makecall()});
		});
	});
	});
};

function fr_session_disconnect(rtc_session){
	rtc_session.terminate();
	fr_audio_disconnect();
	$("#fr_bt_call").html(fr.msg.call);
	$("#fr_bt_call").unbind("click");
	$("#fr_bt_call").click(function() {fr_session_makecall()});
	fr_wcons('call: terminate');
}

function fr_session_busy(rtc_session){
	var options = { status_code: 486, reason_phrase: 'Busy Here'};
	rtc_session.terminate(options);
	fr_wcons('busy');
}

function fr_session_makecall(){
	var to = 'sip:' + fr.params.did +'@sip.flowroute.com';;
	fr_wcons('call:' + fr.params.did);

	var options = {
		'mediaConstraints': {'audio': true, 'video': false},
		'extraHeaders': fr.params.xheaders,
		'RTCConstraints': {"optional": [{'DtlsSrtpKeyAgreement': 'true'}]},
		'sessionTimersExpires': 600
	};
	fr.jssip_ua.call(to, options);
};

function fr_session_trying(rtc_session) {
	$("#fr_bt_call").html(fr.msg.cancel);
	$("#fr_bt_call").unbind("click");
	$("#fr_bt_call").click(function(e) {fr_session_disconnect(rtc_session)});
}

function fr_session_progress(e) {
	fr_audio_connect(e);
}

function fr_session_established(e) {
	$("#fr_bt_call").html(fr.msg.disconnect);
	$("#fr_bt_call").unbind("click");
	$("#fr_bt_call").click(function(e) {fr_session_disconnect(fr.rtc_session)});
	fr_audio_connect(e);
	if (!params.user_muted)
		fr.audio_player.defaultMuted = false;
	fr_wcons('started' + '[' + fr.rtc_session.start_time + ']');
};

function fr_session_answer(rtc_session) {
	fr_stop_ring();
	var options = {
		'mediaConstraints': {'audio': true, 'video': false},
		'extraHeaders': [ 'P-BUA:' + navigator.userAgent, 'P-REF:' + document.referrer],
		'RTCConstraints': {"optional": [{'DtlsSrtpKeyAgreement': 'true'}]}
	};
	rtc_session.answer(options);
	$("#fr_bt_call").html(fr.msg.disconnect);
	$("#fr_bt_call").unbind("click");
	$("#fr_bt_call").click(function(e) {fr_session_disconnect(rtc_session)});
}

function fr_session_incoming(rtc_session,request) {
	fr_play_ring();

	if ($("#fr_target_user").length) {
		$("#fr_target_user").html(request.from.uri.user);
	}

	$("#fr_bt_call").html(fr.msg.answer);
	$("#fr_bt_call").unbind("click");
	$("#fr_bt_call").click(function(e) {fr_session_answer(rtc_session)});
}
