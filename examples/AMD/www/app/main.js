define(function (require) {
    // Load any app-specific modules
    // with a relative require call,
    // like:
    var messages = require('./messages');

    // Load library/vendor modules using
    // full IDs, like:
    var print = require('print');

    // Load secrets.js
    var secrets = require('../../../../secrets');

    print(messages.getHello());

    print("secrets.getConfig() : in main.js");
    print(secrets.getConfig());

});
