var http = require('http');
var secrets = require('../secrets.js');

// Usage:
//    cd examples
//    node example_node.js
//
//  Visit http://127.0.0.1:1337/ in your browser.
//  You should see two identical keys displayed, one original
//  key and then a key that resulted from splitting and combining shares.
//

http.createServer(function (req, res) {

  var key, comb, shares, newShare;

  key = secrets.random(512);
  shares = secrets.share(key, 10, 5);
  comb = secrets.combine( shares );
  newShare = secrets.newShare(8, shares);
  comb = secrets.combine( shares.slice(1,5).concat(newShare) );

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('You should see two identical keys below, before and after share and combine.\n\n' + key + '\n' + comb);

}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
