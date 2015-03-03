// when running in a node.js env.
if (typeof require === "function") {
    crypto = require('crypto');
    sjcl = require('../node_modules/sjcl/sjcl.js');
    secrets = require('../secrets.js');
    //secrets.init(16, "browserSJCLRandom");
}
