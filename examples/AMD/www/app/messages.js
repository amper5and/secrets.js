define(function () {
    return {
        getHello: function () {
            console.log("secrets.getConfig() : in messages.js");
            console.log(secrets.getConfig());
            return 'Hello Secrets!';
        }
    };
});
