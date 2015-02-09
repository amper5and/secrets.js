/*jslint passfail: false, bitwise: true, todo: false, maxerr: 1000 */
/*global secrets, describe, xdescribe, it, xit, expect, beforeEach, afterEach, Uint32Array */

describe("Secrets", function () {

    "use strict";

    describe("should be able to be initialized", function () {

        var key;

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
            // generate a 128 bit hex string key
            key = secrets.random(128);
        });

        it("with an empty arg, which should be 8 bits", function () {
            secrets.init();
            expect(secrets.getConfig().bits).toEqual(8);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });

        it("with an arg of 8, which should be 8 bits", function () {
            secrets.init(8);
            expect(secrets.getConfig().bits).toEqual(8);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });

        it("with an min arg of 3, which should be 3 bits", function () {
            secrets.init(3);
            expect(secrets.getConfig().bits).toEqual(3);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });

        it("with an max arg of 20, which should be 20 bits", function () {
            secrets.init(20);
            expect(secrets.getConfig().bits).toEqual(20);
            // specify a large number of shares for this test
            expect(secrets.combine(secrets.share(key, 500, 2))).toEqual(key);
        });

        it("with an null arg, which should be 8 bits", function () {
            secrets.init(null);
            expect(secrets.getConfig().bits).toEqual(8);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });

        it("with an undefined arg, which should be 8 bits", function () {
            secrets.init(undefined);
            expect(secrets.getConfig().bits).toEqual(8);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });

        it("unless the arg is a number less than 3", function () {
            expect(function () {
                secrets.init(2);
            }).toThrowError("Number of bits must be an integer between 3 and 20, inclusive.");
        });

        it("unless the arg is a number greater than 20", function () {
            expect(function () {
                secrets.init(21);
            }).toThrowError("Number of bits must be an integer between 3 and 20, inclusive.");
        });

    });

    describe("should return its own config with getConfig()", function () {

        it("with no args to init", function () {
            var expectedConfig = {"bits": 8};
            secrets.init();
            expect(secrets.getConfig()).toEqual(expectedConfig);
        });

        it("with 16 bits arg to init", function () {
            var expectedConfig = {"bits": 16};
            secrets.init(16);
            expect(secrets.getConfig()).toEqual(expectedConfig);
        });

    });

    describe("should be able to be created using a custom Random Number Generator function", function () {
        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
        });

        it("when that function accepts a 'bits' arg and returns a bits length string of binary digits", function () {
            var getFixedBitString = function (bits) {
                var arr = new Uint32Array(1);
                arr[0] = 123456789;
                // convert the 'random' num to binary and take only 'bits' characters.
                return arr[0].toString(2).substr(0, bits);
            };

            secrets.setRNG(function (bits) { return getFixedBitString(bits); });

            // Expect the same random value every time since the fixed RNG always
            // returns the same string for a given bitlength.
            expect(secrets.random(128)).toEqual("75bcd15");
        });

        it("unless that function does not return a string as output", function () {
            var getFixedBitString = function (bits) {
                return ["not", "a", "string", bits];
            };
            expect(function () { secrets.setRNG(function (bits) { return getFixedBitString(bits); }); }).toThrowError("Random number generator is invalid (Output is not a string). Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.");
        });

        it("unless that function does not return a string of parseable binary digits as output", function () {
            var getFixedBitString = function (bits) {
                return "abcdef";
            };
            expect(function () { secrets.setRNG(function (bits) { return getFixedBitString(bits); }); }).toThrowError("Random number generator is invalid (Binary string output not parseable to an Integer). Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.");
        });

        it("unless that function returns a string longer than config bits", function () {
            var getFixedBitString = function (bits) {
                return "001010101"; // 9 when expecting 8
            };
            expect(function () { secrets.setRNG(function (bits) { return getFixedBitString(bits); }); }).toThrowError("Random number generator is invalid (Output length is greater than config.bits). Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.");
        });

        it("unless that function returns a string shorter than config bits", function () {
            var getFixedBitString = function (bits) {
                return "0010101"; // 7 when expecting 8
            };
            expect(function () { secrets.setRNG(function (bits) { return getFixedBitString(bits); }); }).toThrowError("Random number generator is invalid (Output length is less than config.bits). Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.");
        });

    });

    describe("should be able to be shared", function () {

        var key;

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
            // generate a 128 bit hex string key
            key = secrets.random(128);
        });

        it("into 'numShares' shares where numShares is greater than the threshold", function () {
            var numShares = 10;
            var threhold = 5;
            var shares = secrets.share(key, numShares, threhold);
            expect(shares.length).toEqual(numShares);
        });

        it("into 'numShares' shares where numShares is equal to the threshold", function () {
            var numShares = 10;
            var threhold = 10;
            var shares = secrets.share(key, numShares, threhold);
            expect(shares.length).toEqual(numShares);
        });

        it("unless 'numShares' is less than the threshold", function () {
            var numShares = 2;
            var threhold = 3;
            expect(function () {
                secrets.share(key, numShares, threhold);
            }).toThrowError("Threshold number of shares was 3 but must be less than or equal to the 2 shares specified as the total to generate.");
        });

        it("unless 'numShares' is less than 2", function () {
            var numShares = 1;
            var threhold = 2;
            expect(function () {
                secrets.share(key, numShares, threhold);
            }).toThrowError("Number of shares must be an integer between 2 and 2^bits-1 (255), inclusive.");
        });

        it("unless 'numShares' is greater than 255", function () {
            var numShares = 256;
            var threhold = 2;
            expect(function () {
                secrets.share(key, numShares, threhold);
            }).toThrowError("Number of shares must be an integer between 2 and 2^bits-1 (255), inclusive. To create 256 shares, use at least 9 bits.");
        });

        it("unless 'threshold' is less than 2", function () {
            var numShares = 2;
            var threhold = 1;
            expect(function () {
                secrets.share(key, numShares, threhold);
            }).toThrowError("Threshold number of shares must be an integer between 2 and 2^bits-1 (255), inclusive.");
        });

        it("unless 'threshold' is greater than 255", function () {
            var numShares = 255;
            var threhold = 256;
            expect(function () {
                secrets.share(key, numShares, threhold);
            }).toThrowError("Threshold number of shares must be an integer between 2 and 2^bits-1 (255), inclusive.  To use a threshold of 256, use at least 9 bits.");
        });

        it("unless 'key' is not in the expected hex format", function () {
            key = "xyz123";
            expect(function () {
                secrets.share(key, 3, 2);
            }).toThrowError("Invalid hex character.");
        });

    });

    describe("should be able to be combined to recreate a secret", function () {

        var key,
            numShares,
            threshold,
            shares;

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
            // generate a 128 bit hex string key
            key = secrets.random(128);
            numShares = 10;
            threshold = 5;
            shares = secrets.share(key, numShares, threshold);
        });

        // This test should not be modified to ensure we don't break old shares!
        it("from a full set of version 0.1.8 *known* good shares for full backwards compatibility", function () {
            // numShares : 10, threshold: 5
            var knownKey = "82585c749a3db7f73009d0d6107dd650";
            var knownShares = ["80111001e523b02029c58aceebead70329000",
                                "802eeb362b5be82beae3499f09bd7f9f19b1c",
                                "803d5f7e5216d716a172ebe0af46ca81684f4",
                                "804e1fa5670ee4c919ffd9f8c71f32a7bfbb0",
                                "8050bd6ac05ceb3eeffcbbe251932ece37657",
                                "8064bb52a3db02b1962ff879d32bc56de4455",
                                "8078a5f11d20cbf8d907c1d295bbda1ee900a",
                                "808808ff7fae45529eb13b1e9d78faeab435f",
                                "809f3b0585740fd80830c355fa501a8057733",
                                "80aeca744ec715290906c995aac371ed118c2"];
            var combinedKey = secrets.combine(knownShares);
            expect(combinedKey).toEqual(knownKey);
        });

        it("from a full set of shares", function () {
            var combinedKey = secrets.combine(shares);
            expect(combinedKey).toEqual(key);
        });

        it("from a threshold minimum set of shares", function () {
            var combinedKey = secrets.combine(shares.slice(0, threshold));
            expect(combinedKey).toEqual(key);
        });

        it("unless given less than the threshold minimum set of shares", function () {
            var combinedKey = secrets.combine(shares.slice(0, threshold - 1));
            expect(combinedKey).not.toEqual(key);
        });

        it("unless given an empty set of shares", function () {
            var combinedKey = secrets.combine([]);
            expect(combinedKey).not.toEqual(key);
        });

        it("unless given a null in place of shares", function () {
            var combinedKey = secrets.combine([]);
            expect(combinedKey).not.toEqual(key);
        });

        // FIXME : A cheater (imposter) share of the right format doesn't force failure.
        xit("unless given a share which was not part of the original set of shares", function () {
            var cheaterKey = secrets.random(10);
            var cheaterShares = secrets.share(cheaterKey, 3, 2);
            shares.push(cheaterShares[0]);
            var combinedKey = secrets.combine(shares);
            expect(combinedKey).not.toEqual(key);
        });

        it("unless given a malformed share", function () {
            shares.push("abc123");

            expect(function () {
                secrets.combine(shares);
            }).toThrowError("Share id must be an integer between 1 and 255, inclusive.");
        });

    });

    describe("should be able to generate a new share to add to an existing set", function () {

        var key;

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
            key = secrets.random(128);
        });

        it("and combine the mixed old/new shares back to the original key", function () {
            var shares = secrets.share(key, 3, 2);
            var newShare = secrets.newShare(4, shares);
            var combinedKey = secrets.combine(shares.slice(1).concat(newShare));
            expect(combinedKey).toEqual(key);
        });

    });

    describe("should be able to round trip convert a string to/from Hex for sharing", function () {

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
        });

        it("if the string is plain ASCII text", function () {
            var key = "acbdefghijklmnopqrstuvwxyz0123456789";
            var shares = secrets.share(secrets.str2hex(key), 3, 2);
            var combinedKey = secrets.hex2str(secrets.combine(shares));
            expect(combinedKey).toEqual(key);
        });

        it("if the string is UTF-8 text", function () {
            var key = "¥ · £ · € · $ · ¢ · ₡ · ₢ · ₣ · ₤ · ₥ · ₦ · ₧ · ₨ · ₩ · ₪ · ₫ · ₭ · ₮ · ₯ · ₹";
            var shares = secrets.share(secrets.str2hex(key), 3, 2);
            var combinedKey = secrets.hex2str(secrets.combine(shares));
            expect(combinedKey).toEqual(key);
        });

        it("if the string is UTF-16 text", function () {
            var key = "𐑡𐑹𐑡 ·𐑚𐑻𐑯𐑸𐑛 ·𐑖𐑷";
            var shares = secrets.share(secrets.str2hex(key), 3, 2);
            var combinedKey = secrets.hex2str(secrets.combine(shares));
            expect(combinedKey).toEqual(key);
        });

    });

    describe("should be able to generate a random Hex string", function () {

        beforeEach(function () {
            secrets.init(8);
            secrets.setRNG();
        });

        it("with valid Hex chars 0-9 and a-f", function () {
            var rnd = secrets.random(128);
            expect(rnd).toMatch(/^[a-f0-9]+$/);
        });

        it("of 2 bit length", function () {
            var rnd = secrets.random(2);
            expect(rnd.length).toEqual(1);
        });

        it("of 128 bit length", function () {
            var rnd = secrets.random(128);
            expect(rnd.length).toEqual(32);
        });

        it("of 512 bit length", function () {
            var rnd = secrets.random(512);
            expect(rnd.length).toEqual(128);
        });

        it("unless bitlength is less than 2", function () {
            expect(function () {
                secrets.random(1);
            }).toThrowError("Number of bits must be an Integer between 1 and 65536.");
        });

        it("unless bitlength is greater than than 65536", function () {
            expect(function () {
                secrets.random(65537);
            }).toThrowError("Number of bits must be an Integer between 1 and 65536.");
        });

    });

});
