
function fr_rcv_msg(e){
	var text = $('textarea#fr_chat').val() + 'received: ' + e.data.request.body + '\n';
	$('textarea#fr_chat').val(text);
	$('textarea#fr_chat').scrollTop($('textarea#fr_chat')[0].scrollHeight);
}

function fr_send_msg(){
	var msg = $('textarea#fr_msg').val();
	var text = $('textarea#fr_chat').val() + 'sent: ' + msg + '\n';
	var to = 'guest@void';
	$('textarea#fr_chat').val(text);
	$('textarea#fr_chat').scrollTop($('textarea#fr_chat')[0].scrollHeight);
	$('textarea#fr_msg').val('')
	session_manager.sendMessage(to, msg);
}

function fr_init_chat(){
	$("#fr_bt_msg").click(function() {send_msg()});
	$("textarea#fr_msg").keypress(function(e) {
		if (e.keyCode == 13 && !e.shiftKey) {
			send_msg();
			return false;
		}
	});
	$("#fr_bt_msg").click(function() {send_msg()});
	fr_set_font();
	$("#fr_bt_msg").html( fr.msg.send );
	$("#fr_bt_clear").html( fr.msg.clear );
	$("#directory").html( fr.msg.directory + " :" );

	$("#fr_bt_clear").click(function() {$('textarea#fr_chat').val('')});
	$("textarea#fr_msg").keypress(function(e) {
		if (e.keyCode == 13 && !e.shiftKey) {
			fr_send_msg();
			return false;
		}
	});
	$('#fr_chat').css('font-size', '12px');
	$('#fr_msg').css('font-size', '12px');
	$('#fr_chat').css('font-family', font_family);
	$('#fr_msg').css('font-family', font_family);
}
