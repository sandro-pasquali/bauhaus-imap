var bauhaus			= require("bauhaus");
var imapConnection	= require('bauhaus-imap').ImapConnection;
var MailParser 		= require("mailparser").MailParser;
var moment			= require('moment');

bauhaus.imap = {
	defaults : {
		host	: "gmail.com"
		port	: 993,
		secure	: true
	},
	
	connection : null
};

bauhaus.imap.connect = function(opts, cb) {

	opts = opts || {};

	var imap = new imapConnection({
        username	: opts.email,
        password	: opts.password,
        host		: opts.host || bauhaus.imap.defaults.host,
        port		: opts.port || bauhaus.imap.defaults.port,
        secure		: opts.secure !== void 0 ? !!opts.secure : bauhaus.imap.defaults.secure
    });

	imap.connect(function(err) {
		if(err) {
			return cb(err);
		}

		fn(null, (authed[key] = {
			email		: email,
			imapDef		: imapDef
		}));
	});

	if(typeof box === "function") {
		cb	= box;
		box = "INBOX";
	} 

	imap.connect(function(err) {
		if(err) {
			return cb(err);
		} 
		
		imap.openBox(box, false, function(err, mailbox) {
			if(err) {
				return cb(err);
			} 
			
			cb(null, mailbox)
		});
	})
};

bauhaus.imap.search = function(box, messages, cb) {
	bauhaus.imap.connect(box, function(err, mailbox) {
	
		if(err) {
			return cb(err);
		}
		imap.search([ ['SUBJECT', 'waywot:'] ], function(err, results) {
			if(err) {
				return cb("Mail search failed.");
			}
	
			//	No results. Broadcast empty array.
			//
			if(results.length < 1) {
				return cb(null, []);
			}
	
			var fetch = imap.fetch(results, {
				request: {
					headers: ['subject', 'date', 'from'],
					body: false
				}
			});
	
			fetch.on('message', function(msg) {
				msg.on('end', function() {
					var subj = msg.headers.subject[0].split("waywot:")[1];
					
					messages[subj] = messages[subj] || [];
					messages[subj].push({
						seqno 		: msg.seqno,
						uid			: (box === "INBOX" ? "i" : "s") + msg.uid,
						flags 		: msg.flags,
						date		: msg.date,
						stamp		: moment(msg.date).unix()*1000,
						from		: msg.headers.from[0]
					})
				});
			});
			
			fetch.on('end', function() {
				cb(null, messages);
			});
			
		});
	});
}

bauhaus.imap.fetchByUID = function(boxes, box, messages, cb) {
	bauhaus.imap.connect(box, function(err, mailbox) {
	
		if(err) {
			return cb(err);
		}
	
		var fetch = imap.fetch(boxes[box], {
			request: {
				body	: 'full'
			}
		});
		
		var raw = [];
		fetch.on('message', function(msg) {
		
			var body = '';

			msg.on('data', function(chunk) {
				body += chunk.toString('utf8');
			});
			msg.on('end', function() {
			
			console.log(msg)
			
				raw.push({
					body 	: body,
					msgId	: msg["x-gm-msgid"]
				});
			});
		});
		
		fetch.on('end', function() {
		
			imap.logout();
			
			var parsedMsgs = []
			
			raw.forEach(function(mess) {
				var parser 	= new MailParser();
				parser.on("end", function(mailObj) {
					parsedMsgs.push({
						date	: mailObj.headers.date,	
						msgId	: mess.msgId,
						body	: !!mailObj.html ? mailObj.html : mailObj.text
					});
					if(parsedMsgs.length === raw.length) {
					
						parsedMsgs.sort(function(a, b) {
							return a.msgId > b.msgId;
						});
					
						cb(null, parsedMsgs);
					}
				});
				parser.write(mess.body);
				parser.end();
			});
		});
	});
}