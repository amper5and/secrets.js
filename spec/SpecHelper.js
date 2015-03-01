// when running in a node.js env.
if (typeof require === "function") {
    crypto = require('crypto');
    secrets = require('../secrets.js');
}
