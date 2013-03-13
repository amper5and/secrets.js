secrets.setRNG(null, false);

if(secrets.getConfig().unsafePRNG){
	secrets.setRNG(function(bits){
		str = '';
		while(str.length < bits || (str.match(/0/g)||[]).length === str.length){
			str += isaac.random().toString(2).substr(2);
		}
		return str.slice(0,bits)
	}, false)
}

var pw = 'PassGuardian';

function error(location, message, hide){
	$($(location).parent()).before('<div class="alert alert-error fade in popupError"><button type="button" class="close" data-dismiss="alert">&times;</button><h4>Error</h4>'+message+'</div>')
	if(hide){
		$(hide).hide();
	}
	$(location).removeClass('disabled');
}
$(document).on('click', '#splitButton', function(ev){
	var el = $(this)
	if(el.hasClass('disabled')){
		console.log('disabled')
		return;
	}else{
		console.log('adding')
		el.addClass('disabled');
	}
	
	if(secrets.getConfig().bits !== 8){
		secrets.init(8);
	}
	$('#split-tab .popupError').remove();
	
	var string = $('#string').val();
	if(string === ''){
		return error(this, 'Input cannot be empty.', '#split-result')
	}
	var hash = CryptoJS.SHA3(string);
	var type = $('.inputType.active').attr('data-inputType');
	var numShares = $('#numShares').val() * 1;
	if(typeof numShares !== 'number' || isNaN(numShares) || numShares < 2 || numShares > 255){
		return error(this, 'Number of shares must be an integer between 2 and 255, inclusive.', '#split-result')
	}
	var threshold = $('#threshold').val() * 1;
	if(typeof threshold !== 'number' || isNaN(threshold) || threshold < 2 || threshold > 255){
		return error(this, 'Threshold must be an integer between 2 and 255, inclusive.', '#split-result')
	}
	
	if(type==='text'){
		string = secrets.str2hex(string);
	}
	if(!$('#shares').length){
		$(this).parent().after('<div id="split-result" style="display:none;" class="alert alert-block alert-success fade in"><button type="button" class="close" data-dismiss="alert">&times;</button><h4>Secret shares</h4>One share per line<pre id="shares"></pre></div>');
	}
	try{
		var shares = secrets.share(string, numShares, threshold);
		var textarea = $('#shares');
		shares = shares.join('<br>');
		textarea.html(shares);
		$('#split-hash').text(hash)
		$('#split-result').show();
		secrets.getConfig().unsafePRNG ? $('#PRNGwarning').show() : $('#PRNGwarning').hide();
		numShares<threshold ? $('#mismatchWarning').show() : $('#mismatchWarning').hide();
	}catch(e){
		return error(this, e, '#split-result')
	}
	el.removeClass('disabled');	
});

$(document).on('click', '#reconButton', function(ev){
	$('#recon-tab .popupError').remove();
	$('#hashMismatchError').hide();
	var inputHash = $('#inputhash').val();
	var shares = [];
	$('.shareInput').each(function(){
		var share = $.trim($(this).val());
		if(share){
			shares.push(share);
		}else if($('.shareInput').length >= 3){
			$(this).remove();
		}
	})
	if(shares.length<2){
		return error(this, 'Enter at least 2 shares.', '#recon-result')
	}
	var type = $('.reconType.active').attr('data-inputType');
	
	if(!$('#reconstruction').length){
		$(this).parent().after('<div id="recon-result" style="display:none;" class="alert alert-block alert-success fade in"><button type="button" class="close" data-dismiss="alert">&times;</button><h4>Reconstructed secret</h4><pre id="reconstruction"></pre></div>');
	}
	try{
		var recon = secrets.combine(shares);
		if(type === 'text'){
			recon = secrets.hex2str(recon);
		}
		var hash = CryptoJS.SHA3(recon).toString();
		$('#reconstruction').text(recon);
		$('#recon-hash').text(hash);
		$('#recon-result').show();
		if(inputHash && $.trim(inputHash) !== hash){
			$('#hashMismatchError').show();
		}
	}catch(e){
		return error(this, 'Reconstruction ' + e, '#recon-result')
	}
})

$(document).on('click', '.generate', function(ev){
	ev.preventDefault();
	var rnd = secrets.random($(this).attr('data-bits') * 1);
	$('#string').replaceWith('<input class="input-block-level" id="string" type="text" placeholder="Secret to share" value="'+rnd+'">')
	$('.inputType[data-inputType=text]').removeClass('active')
	$('.inputType[data-inputType=hex]').addClass('active')
})

$(document).on('click', '#addShareButton', function(ev){
	$('#inputShares').append('<input type="text" class="input-block-level shareInput" placeholder="Enter one share">')
})

$(document).on('click','#clearButton', function(ev){
	$('#string').val('');
})

$(document).on('click','#clearAllButton', function(ev){
	$('.shareInput').each(function(){
		$(this).val('');
	})
})

$(document).on('click','.inputType[data-inputType=hex]', function(ev){
	var string = $('#string');
	var val = string.val().replace(/\n/g,' ');
	if(string.is('textarea')){
		string.replaceWith('<input class="input-block-level" id="string" type="text" placeholder="Secret to share" value="'+val+'">')
	}
})
$(document).on('click','.inputType[data-inputType=text]', function(ev){
	var string = $('#string');
	var val = string.val();
	if(!string.is('textarea')){
		string.replaceWith('<textarea class="input-block-level" id="string" type="text" rows="3" placeholder="Secret to share">'+val+'</textarea>')
	}
})

$(document).on('click','#resetSplitForm', function(ev){
	$('#split-tab .popupError').remove();
	var string = $('#string').val('');
	if(!string.is('textarea')){
		string.replaceWith('<textarea class="input-block-level" id="string" type="text" rows="3" placeholder="Secret to share"></textarea>')
	}
	$('#numShares').val(2);
	$('#threshold').val(2);
	$('.inputType.active').removeClass('active');
	$('.inputType[data-inputType=text]').addClass('active');
	$('#split-result').hide();
	$('#shares').empty();
  	$('#split-hash').empty();
})

$(document).on('click','#resetReconForm', function(ev){
	$('#recon-tab .popupError').remove();
	$('.shareInput').each(function(){
		if($('.shareInput').length >=3 ){
			$(this).remove()
		}else{
			$(this).val('');
		}
	})
	$('#string').val('');
	$('#numShares').val(2);
	$('#threshold').val(2);
	$('.reconType.active').removeClass('active');
	$('.reconType[data-inputType=text]').addClass('active');
	$('#inputhash').val('');
	$('#recon-result').hide();
	$('#reconstruction').empty();
	$('hashMismatchError').empty();
	$('#recon-hash').empty();
})

$(document).on('click', '#split-simple', function(ev){
	$('#split .advancedElement').hide();
	$('.reconType.active').removeClass('active');
	$('.reconType[data-inputType=text]').addClass('active');
});

$(document).on('click', '#split-advanced', function(ev){
	$('#split .advancedElement').show();
})
$(document).on('click', '#recon-advanced', function(ev){
	$('#reconstruct .advancedElement').show();
})

$(document).on('click', '#recon-simple', function(ev){
	$('#reconstruct .advancedElement').hide();
	$('.reconType.active').removeClass('active');
	$('.reconType[data-inputType=text]').addClass('active');
});
