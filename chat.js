
/* INSTANT MESSAGING */
function rcv_msg(e){
	var date = new Date;
	var ms = new Date().getTime();
	var now = (date.getHours()<10?'0':'') + date.getHours()   +':'+
		(date.getMinutes()<10?'0':'') + date.getMinutes() +':'+
		(date.getSeconds()<10?'0':'') + date.getSeconds() ;
	var msg = e.data.request.body;
	var chat_height = $('#fr_chat_div').height();
	if( chat_height < 200 ){
		$('#fr_chat_div').height( chat_height + 75 )
	}
	var from =  e.data.request.from.uri.user;
	if(msg == 'wc_error:no_agent'){
		msg = fr.msg.error_no_agent;
		from = "";
	} else if (from == 'check_status') {
		fr.update_status(msg);
		// update intervention and users status
		return;
	}

	var bubble_width = 25 + (msg.length*7.5);
	if(bubble_width > 190){bubble_width=190};

	if( $("#fr_target_user").length ){
		if($("#fr_target_user").html() != from) {
			var iid = e.data.request.getHeader('P-IID');
			if($("#fr_unread_"+iid).length){
				var unread_msg = parseInt($("#fr_unread_"+iid).html()) + 1;
				$("#fr_unread_"+iid).html(unread_msg);
				return;
			} else {
				return;
				// add the intervention ?
			}
		}
	}

	var chat_block = '<li class=fr_li>'+
                            '<div id="bbr'+ms+'" style="width:'+bubble_width+'px;" class="bubble_reply"></div>'+
                            '<div class="comment_info_recv">'+from+'<br>'+now+'</div>'+
                         '</li>';

	$("#fr_chat").append(chat_block);
	$('#bbr'+ms).text(msg).append();
	$('#fr_chat_div').scrollTop($('#fr_chat_div')[0].scrollHeight);
}

function send_msg(){
	var options = {
		'extraHeaders': [ 'P-BUA: ' + navigator.userAgent, 'P-REF: ' + document.referrer, 'P-EMAIL: '+ fr.email ]
	};

	var msg = $('textarea#fr_msg').val();
	if(msg == ''){return;}
	//$('#fr_chat_div').css('height','150px');
	var chat_height = $('#fr_chat_div').height();
	if( chat_height < 200 ){
		$('#fr_chat_div').height( chat_height + 50 )
	}
	var date = new Date;
	var ms = new Date().getTime();
	var now = (date.getHours()<10?'0':'') + date.getHours()   +':'+
		(date.getMinutes()<10?'0':'') + date.getMinutes() +':'+
		(date.getSeconds()<10?'0':'') + date.getSeconds() ;

	var bubble_width = 25 + (msg.length*7.5);
	if(bubble_width > 190){bubble_width=190};

	var chat_block = '<li class=fr_li>'+
                            '<div class="comment_info_sent">'+fr.msg.me+'<br>'+now+'</div>'+
                              '<div id="bb'+ms+'" style="width:'+bubble_width+'px;" class="bubble"></div></li>';
	var to = 'sip:agent_'+ fr.account +'@media.castmm.com';
	$("#fr_chat").append(chat_block);
	$('#bb'+ms).text(msg).append();
	$('textarea#fr_msg').val('');
	if( $('#fr_target_user').length ){
		to = $('#fr_target_user').html().toString() +'@198.27.70.174';
	} else {
		to = 'agent_'+ fr.account +'@198.27.70.174';
	}
	fr.session_manager.sendMessage(to, msg, options);
	$('#fr_chat_div').scrollTop($('#fr_chat_div')[0].scrollHeight);
}

function send_check_msg(){
	var to = 'check_agent_'+ fr.account +'@void';
	cmm.session_manager.sendMessage(to, 'online ?');
}

