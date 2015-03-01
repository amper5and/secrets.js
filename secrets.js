// @preserve author Alexander Stetsyuk
// @preserve author Glenn Rempe <glenn@rempe.us>
// @license MIT

/*jslint passfail: false, bitwise: true, nomen: true, plusplus: true, todo: false, maxerr: 1000 */
/*global define, require, module, exports, window, Uint32Array, sjcl */

// eslint : http://eslint.org/docs/configuring/
/*eslint-env node, browser, jasmine, sjcl */
/*eslint no-underscore-dangle:0 */

// UMD (Universal Module Definition)
// Uses Node, AMD or browser globals to create a module. This module creates
// a global even when AMD is used. This is useful if you have some scripts
// that are loaded by an AMD loader, but they still want access to globals.
// See : https://github.com/umdjs/umd
// See : https://github.com/umdjs/umd/blob/master/returnExportsGlobal.js
//
(function (root, factory) {
    "use strict";

    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define([], function () {
            /*eslint-disable no-return-assign */
            return (root.secrets = factory());
            /*eslint-enable no-return-assign */
        });
    } else if (typeof exports === "object") {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require("crypto"));
    } else {
        // Browser globals (root is window)
        root.secrets = factory(root.crypto);
    }
}(this, function (crypto) {
    "use strict";

    var defaults,
        config,
        preGenPadding,
        runCSPRNGTest,
        sjclParanoia,
        CSPRNGTypes;

    function reset() {
        defaults = {
            bits: 8, // default number of bits
            radix: 16, // work with HEX by default
            minBits: 3,
            maxBits: 20, // this permits 1,048,575 shares, though going this high is NOT recommended in JS!
            bytesPerChar: 2,
            maxBytesPerChar: 6, // Math.pow(256,7) > Math.pow(2,53)

            // Primitive polynomials (in decimal form) for Galois Fields GF(2^n), for 2 <= n <= 30
            // The index of each term in the array corresponds to the n for that polynomial
            // i.e. to get the polynomial for n=16, use primitivePolynomials[16]
            primitivePolynomials: [null, null, 1, 3, 3, 5, 3, 3, 29, 17, 9, 5, 83, 27, 43, 3, 45, 9, 39, 39, 9, 5, 3, 33, 27, 9, 71, 39, 9, 5, 83]
        };
        config = {};
        preGenPadding = new Array(1024).join("0"); // Pre-generate a string of 1024 0's for use by padLeft().
        runCSPRNGTest = true;
        sjclParanoia = 10;

        // WARNING : Never use 'testRandom' except for testing.
        CSPRNGTypes = ["nodeCryptoRandomBytes", "browserCryptoGetRandomValues", "browserSJCLRandom", "testRandom"];
    }

    function isSetRNG() {
        if (config && config.rng && typeof config.rng === "function") {
            return true;
        }

        return false;
    }

    // Pads a string `str` with zeros on the left so that its length is a multiple of `bits`
    function padLeft(str, multipleOfBits) {
        var missing;

        if (multipleOfBits === 0 || multipleOfBits === 1) {
            return str;
        }

        if (multipleOfBits && multipleOfBits > 1024) {
            throw new Error("Padding must be multiples of no larger than 1024 bits.");
        }

        multipleOfBits = multipleOfBits || config.bits;

        if (str) {
            missing = str.length % multipleOfBits;
        }

        if (missing) {
            return (preGenPadding + str).slice(-(multipleOfBits - missing + str.length));
        }

        return str;
    }

    function hex2bin(str) {
        var bin = "",
            num,
            i;

        for (i = str.length - 1; i >= 0; i--) {
            num = parseInt(str[i], 16);

            if (isNaN(num)) {
                throw new Error("Invalid hex character.");
            }

            bin = padLeft(num.toString(2), 4) + bin;
        }
        return bin;
    }

    function bin2hex(str) {
        var hex = "",
            num,
            i;

        str = padLeft(str, 4);

        for (i = str.length; i >= 4; i -= 4) {
            num = parseInt(str.slice(i - 4, i), 2);
            if (isNaN(num)) {
                throw new Error("Invalid binary character.");
            }
            hex = num.toString(16) + hex;
        }

        return hex;
    }

    // Returns a pseudo-random number generator of the form function(bits){}
    // which should output a random string of 1's and 0's of length `bits`.
    // `type` (Optional) : A string representing the CSPRNG that you want to
    // force to be loaded, overriding feature detection. Can be one of:
    //    "nodeCryptoRandomBytes"
    //    "browserCryptoGetRandomValues"
    //    "browserSJCLRandom"
    //
    function getRNG(type) {

        function construct(bits, arr, radix, size) {
            var i = 0,
                len,
                str = "",
                parsedInt;

            if (arr) {
                len = arr.length - 1;
            }

            while (i < len || (str.length < bits)) {
                // convert any negative nums to positive with Math.abs()
                parsedInt = Math.abs(parseInt(arr[i], radix));
                str = str + padLeft(parsedInt.toString(2), size);
                i++;
            }

            str = str.substr(-bits);

            // return null so this result can be re-processed if the result is all 0's.
            if ((str.match(/0/g) || []).length === str.length) {
                return null;
            }

            return str;
        }

        // Node.js : crypto.randomBytes()
        // Note : Node.js and crypto.randomBytes() uses the OpenSSL RAND_bytes() function for its CSPRNG.
        //        Node.js will need to have been compiled with OpenSSL for this to work.
        // See : https://github.com/joyent/node/blob/d8baf8a2a4481940bfed0196308ae6189ca18eee/src/node_crypto.cc#L4696
        // See : https://www.openssl.org/docs/crypto/rand.html
        function nodeCryptoRandomBytes(bits) {
            var buf,
                bytes,
                radix,
                size,
                str = null;

            radix = 16;
            size = 4;
            bytes = Math.ceil(bits / 8);

            while (str === null) {
                buf = crypto.randomBytes(bytes);
                str = construct(bits, buf.toString("hex"), radix, size);
            }

            return str;
        }

        // Browser : window.crypto.getRandomValues()
        // See : https://dvcs.w3.org/hg/webcrypto-api/raw-file/tip/spec/Overview.html#dfn-Crypto
        // See : https://developer.mozilla.org/en-US/docs/Web/API/RandomSource/getRandomValues
        // Supported Browsers : http://caniuse.com/#search=crypto.getRandomValues
        function browserCryptoGetRandomValues(bits) {
            var elems,
                radix,
                size,
                str = null;

            radix = 10;
            size = 32;
            elems = Math.ceil(bits / 32);
            while (str === null) {
                str = construct(bits, window.crypto.getRandomValues(new Uint32Array(elems)), radix, size);
            }

            return str;
        }

        // Browser SJCL : If the Stanford Javascript Crypto Library (SJCL) is loaded in the browser
        // then use it as a fallback CSPRNG when window.crypto.getRandomValues() is not available.
        // It may require some time and mouse movements to be fully seeded. Uses a modified version
        // of the Fortuna RNG.
        // See : https://bitwiseshiftleft.github.io/sjcl/
        function browserSJCLRandom(bits) {
            var elems,
                radix,
                size,
                str = null;

            radix = 10;
            size = 32;
            elems = Math.ceil(bits / 32);

            if(sjcl.random.isReady(sjclParanoia)) {
                str = construct(bits, sjcl.random.randomWords(elems, sjclParanoia), radix, size);
            } else {
                throw new Error("SJCL isn't finished seeding the RNG yet.");
            }

            return str;
        }

        // /////////////////////////////////////////////////////////////
        // WARNING : DO NOT USE. For testing purposes only.
        // /////////////////////////////////////////////////////////////
        // This function will return repeatable non-random test bits. Can be used
        // for testing only. Node.js does not return proper random bytes
        // when run within a PhantomJS container.
        function testRandom(bits) {
            var arr,
                elems,
                int,
                radix,
                size,
                str = null;

            radix = 10;
            size = 32;
            elems = Math.ceil(bits / 32);
            int = 123456789;
            arr = new Uint32Array(elems);

            // Fill every element of the Uint32Array with the same int.
            for (var i = 0; i < arr.length; i++) {
                arr[i] = int;
            }

            while (str === null) {
                str = construct(bits, arr, radix, size);
            }

            return str;
        }

        // Return a random generator function for browsers that support HTML5
        // window.crypto.getRandomValues(), Node.js compiled with OpenSSL support.
        // or the Stanford Javascript Crypto Library Fortuna RNG.
        // WARNING : NEVER use testRandom outside of a testing context. Totally non-random!
        if (type && type === "testRandom") {
            config.typeCSPRNG = type;
            return testRandom;
        } else if (type && type === "nodeCryptoRandomBytes") {
            config.typeCSPRNG = type;
            return nodeCryptoRandomBytes;
        } else if (type && type === "browserCryptoGetRandomValues") {
            config.typeCSPRNG = type;
            return browserCryptoGetRandomValues;
        } else if (type && type === "browserSJCLRandom") {
            runCSPRNGTest = false;
            config.typeCSPRNG = type;
            return browserSJCLRandom;
        } else if (typeof crypto === "object" && typeof crypto.randomBytes === "function") {
            config.typeCSPRNG = "nodeCryptoRandomBytes";
            return nodeCryptoRandomBytes;
        } else if (window && window.crypto && (typeof window.crypto.getRandomValues === "function" || typeof window.crypto.getRandomValues === "object") && (typeof Uint32Array === "function" || typeof Uint32Array === "object")) {
            config.typeCSPRNG = "browserCryptoGetRandomValues";
            return browserCryptoGetRandomValues;
        } else if (window && window.sjcl && typeof window.sjcl === "object" && typeof window.sjcl.random === "object") {
            runCSPRNGTest = false;
            config.typeCSPRNG = "browserSJCLRandom";
            return browserSJCLRandom;
        }

    }

    // Splits a number string `bits`-length segments, after first
    // optionally zero-padding it to a length that is a multiple of `padLength.
    // Returns array of integers (each less than 2^bits-1), with each element
    // representing a `bits`-length segment of the input string from right to left,
    // i.e. parts[0] represents the right-most `bits`-length segment of the input string.
    function splitNumStringToIntArray(str, padLength) {
        var parts = [],
            i;

        if (padLength) {
            str = padLeft(str, padLength);
        }

        for (i = str.length; i > config.bits; i -= config.bits) {
            parts.push(parseInt(str.slice(i - config.bits, i), 2));
        }

        parts.push(parseInt(str.slice(0, i), 2));

        return parts;
    }

    // Polynomial evaluation at `x` using Horner's Method
    // NOTE: fx=fx * x + coeff[i] ->  exp(log(fx) + log(x)) + coeff[i],
    //       so if fx===0, just set fx to coeff[i] because
    //       using the exp/log form will result in incorrect value
    function horner(x, coeffs) {
        var logx = config.logs[x],
            fx = 0,
            i;

        for (i = coeffs.length - 1; i >= 0; i--) {
            if (fx !== 0) {
                fx = config.exps[(logx + config.logs[fx]) % config.maxShares] ^ coeffs[i];
            } else {
                fx = coeffs[i];
            }
        }

        return fx;
    }

    // Evaluate the Lagrange interpolation polynomial at x = `at`
    // using x and y Arrays that are of the same length, with
    // corresponding elements constituting points on the polynomial.
    function lagrange(at, x, y) {
        var sum = 0,
            len,
            product,
            i,
            j;

        for (i = 0, len = x.length; i < len; i++) {
            if (y[i]) {

                product = config.logs[y[i]];

                for (j = 0; j < len; j++) {
                    if (i !== j) {
                        if (at === x[j]) { // happens when computing a share that is in the list of shares used to compute it
                            product = -1; // fix for a zero product term, after which the sum should be sum^0 = sum, not sum^1
                            break;
                        }
                        product = (product + config.logs[at ^ x[j]] - config.logs[x[i] ^ x[j]] + config.maxShares) % config.maxShares; // to make sure it's not negative
                    }
                }

                // though exps[-1]= undefined and undefined ^ anything = anything in
                // chrome, this behavior may not hold everywhere, so do the check
                sum = product === -1 ? sum : sum ^ config.exps[product];
            }

        }

        return sum;
    }

    // This is the basic polynomial generation and evaluation function
    // for a `config.bits`-length secret (NOT an arbitrary length)
    // Note: no error-checking at this stage! If `secret` is NOT
    // a NUMBER less than 2^bits-1, the output will be incorrect!
    function getShares(secret, numShares, threshold) {
        var shares = [],
            coeffs = [secret],
            i,
            len;

        for (i = 1; i < threshold; i++) {
            coeffs[i] = parseInt(config.rng(config.bits), 2);
        }

        for (i = 1, len = numShares + 1; i < len; i++) {
            shares[i - 1] = {
                x: i,
                y: horner(i, coeffs)
            };
        }

        return shares;
    }

    function constructPublicShareString(bits, id, data) {
        var bitsBase36,
            idHex,
            idMax,
            idPaddingLen,
            newShareString;

        id = parseInt(id, config.radix);
        bits = parseInt(bits, 10) || config.bits;
        bitsBase36 = bits.toString(36).toUpperCase();
        idMax = Math.pow(2, bits) - 1;
        idPaddingLen = idMax.toString(config.radix).length;
        idHex = padLeft(id.toString(config.radix), idPaddingLen);

        if (typeof id !== "number" || id % 1 !== 0 || id < 1 || id > idMax) {
            throw new Error("Share id must be an integer between 1 and " + idMax + ", inclusive.");
        }

        newShareString = bitsBase36 + idHex + data;

        return newShareString;
    }

    // EXPORTED FUNCTIONS
    // //////////////////

    var secrets = {

        init: function (bits, rngType) {
            var logs = [],
                exps = [],
                x = 1,
                primitive,
                i;

            // reset all config back to initial state
            reset();

            if (bits && (typeof bits !== "number" || bits % 1 !== 0 || bits < defaults.minBits || bits > defaults.maxBits)) {
                throw new Error("Number of bits must be an integer between " + defaults.minBits + " and " + defaults.maxBits + ", inclusive.");
            }

            if (rngType && CSPRNGTypes.indexOf(rngType) === -1) {
                throw new Error("Invalid RNG type argument : '" + rngType + "'");
            }

            config.radix = defaults.radix;
            config.bits = bits || defaults.bits;
            config.size = Math.pow(2, config.bits);
            config.maxShares = config.size - 1;

            // Construct the exp and log tables for multiplication.
            primitive = defaults.primitivePolynomials[config.bits];

            for (i = 0; i < config.size; i++) {
                exps[i] = x;
                logs[x] = i;
                x = x << 1;              // Left shift assignment
                if (x >= config.size) {
                    x = x ^ primitive;   // Bitwise XOR assignment
                    x = x & config.maxShares;  // Bitwise AND assignment
                }
            }

            config.logs = logs;
            config.exps = exps;

            if (rngType) {
                this.setRNG(rngType);
            }

            if (!isSetRNG()) {
                this.setRNG();
            }

            // Setup SJCL and start collecting entropy from mouse movements
            if (config.typeCSPRNG === "browserSJCLRandom") {
                /*eslint-disable new-cap */
                sjcl.random = new sjcl.prng(sjclParanoia);
                /*eslint-enable new-cap */
                sjcl.random.startCollectors();
            }

            if (!isSetRNG() || !config.bits || !config.size || !config.maxShares || !config.logs || !config.exps || config.logs.length !== config.size || config.exps.length !== config.size) {
                throw new Error("Initialization failed.");
            }

        },

        // Evaluates the Lagrange interpolation polynomial at x=`at` for
        // individual config.bits-length segments of each share in the `shares`
        // Array. Each share is expressed in base `inputRadix`. The output
        // is expressed in base `outputRadix'.
        combine: function (shares, at) {
            var i,
                idx,
                j,
                len,
                len2,
                result = "",
                setBits,
                share,
                splitShare,
                x = [],
                y = [];

            at = at || 0;

            for (i = 0, len = shares.length; i < len; i++) {
                share = this.extractShareComponents(shares[i]);

                // All shares must have the same bits settings.
                if (setBits === undefined) {
                    setBits = share.bits;
                } else if (share.bits !== setBits) {
                    throw new Error("Mismatched shares: Different bit settings.");
                }

                // Reset everything to the bit settings of the shares.
                if (config.bits !== setBits) {
                    this.init(setBits);
                }

                // Check if this share.id is already in the Array
                // and proceed if it is not found.
                if (x.indexOf(share.id) === -1) {
                    idx = x.push(share.id) - 1;
                    splitShare = splitNumStringToIntArray(hex2bin(share.data));

                    for (j = 0, len2 = splitShare.length; j < len2; j++) {
                        y[j] = y[j] || [];
                        y[j][idx] = splitShare[j];
                    }
                }

            }

            for (i = 0, len = y.length; i < len; i++) {
                result = padLeft(lagrange(at, x, y[i]).toString(2)) + result;
            }

            // reconstructing the secret
            if (at === 0) {
                //find the first 1
                idx = result.indexOf("1");
                return bin2hex(result.slice(idx + 1));
            }

            return bin2hex(result);
        },

        getConfig: function () {
            var obj = {};
            obj.radix = config.radix;
            obj.bits = config.bits;
            obj.maxShares = config.maxShares;
            obj.hasCSPRNG = isSetRNG();
            obj.typeCSPRNG = config.typeCSPRNG;
            return obj;
        },

        // Given a public share, extract the bits (Integer), share ID (Integer), and share data (Hex)
        // and return an Object containing those components.
        extractShareComponents: function (share) {
            var bits,
                id,
                idLen,
                max,
                obj = {},
                regexStr,
                shareComponents;

            // Extract the first char which represents the bits in Base 36
            bits = parseInt(share.substr(0, 1), 36);

            if (bits && (typeof bits !== "number" || bits % 1 !== 0 || bits < defaults.minBits || bits > defaults.maxBits)) {
                throw new Error("Invalid share : Number of bits must be an integer between " + defaults.minBits + " and " + defaults.maxBits + ", inclusive.");
            }

            // calc the max shares allowed for given bits
            max = Math.pow(2, bits) - 1;

            // Determine the ID length which is variable and based on the bit count.
            idLen = (Math.pow(2, bits) - 1).toString(config.radix).length;

            // Extract all the parts now that the segment sizes are known.
            regexStr = "^([a-kA-K3-9]{1})([a-fA-F0-9]{" + idLen + "})([a-fA-F0-9]+)$";
            shareComponents = new RegExp(regexStr).exec(share);

            // The ID is a Hex number and needs to be converted to an Integer
            if (shareComponents) {
                id = parseInt(shareComponents[2], config.radix);
            }

            if (typeof id !== "number" || id % 1 !== 0 || id < 1 || id > max) {
                throw new Error("Invalid share : Share id must be an integer between 1 and " + config.maxShares + ", inclusive.");
            }

            if (shareComponents && shareComponents[3]) {
                obj.bits = bits;
                obj.id = id;
                obj.data = shareComponents[3];
                return obj;
            }

            throw new Error("The share data provided is invalid : " + share);

        },

        // Set the PRNG to use. If no RNG function is supplied, pick a default using getRNG()
        setRNG: function (rng) {

            var errPrefix = "Random number generator is invalid ",
                errSuffix = " Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.";

            if (rng && typeof rng === "string" && CSPRNGTypes.indexOf(rng) === -1) {
                throw new Error("Invalid RNG type argument : '" + rng + "'");
            }

            // If RNG was not specified at all,
            // try to pick one appropriate for this env.
            if (!rng) {
                rng = getRNG();
            }

            // If `rng` is a string, try to forcibly
            // set the RNG to the type specified.
            if (rng && typeof rng === "string") {
                rng = getRNG(rng);
            }

            if (runCSPRNGTest) {

                if (rng && typeof rng !== "function") {
                    throw new Error(errPrefix + "(Not a function)." + errSuffix);
                }

                if (rng && typeof rng(config.bits) !== "string") {
                    throw new Error(errPrefix + "(Output is not a string)." + errSuffix);
                }

                if (rng && !parseInt(rng(config.bits), 2)) {
                    throw new Error(errPrefix + "(Binary string output not parseable to an Integer)." + errSuffix);
                }

                if (rng && rng(config.bits).length > config.bits) {
                    throw new Error(errPrefix + "(Output length is greater than config.bits)." + errSuffix);
                }

                if (rng && rng(config.bits).length < config.bits) {
                    throw new Error(errPrefix + "(Output length is less than config.bits)." + errSuffix);
                }

            }

            config.rng = rng;

            return true;
        },

        // Converts a given UTF16 character string to the HEX representation.
        // Each character of the input string is represented by
        // `bytesPerChar` bytes in the output string which defaults to 2.
        str2hex: function (str, bytesPerChar) {
            var hexChars,
                max,
                out = "",
                neededBytes,
                num,
                i,
                len;

            if (typeof str !== "string") {
                throw new Error("Input must be a character string.");
            }

            if (!bytesPerChar) {
                bytesPerChar = defaults.bytesPerChar;
            }

            if (typeof bytesPerChar !== "number" || bytesPerChar < 1 || bytesPerChar > defaults.maxBytesPerChar || bytesPerChar % 1 !== 0) {
                throw new Error("Bytes per character must be an integer between 1 and " + defaults.maxBytesPerChar + ", inclusive.");
            }

            hexChars = 2 * bytesPerChar;
            max = Math.pow(16, hexChars) - 1;

            for (i = 0, len = str.length; i < len; i++) {
                num = str[i].charCodeAt();

                if (isNaN(num)) {
                    throw new Error("Invalid character: " + str[i]);
                }

                if (num > max) {
                    neededBytes = Math.ceil(Math.log(num + 1) / Math.log(256));
                    throw new Error("Invalid character code (" + num + "). Maximum allowable is 256^bytes-1 (" + max + "). To convert this character, use at least " + neededBytes + " bytes.");
                }

                out = padLeft(num.toString(16), hexChars) + out;
            }
            return out;
        },

        // Converts a given HEX number string to a UTF16 character string.
        hex2str: function (str, bytesPerChar) {
            var hexChars,
                out = "",
                i,
                len;

            if (typeof str !== "string") {
                throw new Error("Input must be a hexadecimal string.");
            }
            bytesPerChar = bytesPerChar || defaults.bytesPerChar;

            if (typeof bytesPerChar !== "number" || bytesPerChar % 1 !== 0 || bytesPerChar < 1 || bytesPerChar > defaults.maxBytesPerChar) {
                throw new Error("Bytes per character must be an integer between 1 and " + defaults.maxBytesPerChar + ", inclusive.");
            }

            hexChars = 2 * bytesPerChar;

            str = padLeft(str, hexChars);

            for (i = 0, len = str.length; i < len; i += hexChars) {
                out = String.fromCharCode(parseInt(str.slice(i, i + hexChars), 16)) + out;
            }

            return out;
        },

        // Generates a random bits-length number string using the PRNG
        random: function (bits) {

            if (typeof bits !== "number" || bits % 1 !== 0 || bits < 2 || bits > 65536) {
                throw new Error("Number of bits must be an Integer between 1 and 65536.");
            }

            if (config.typeCSPRNG === "browserSJCLRandom" && sjcl.random.isReady(sjclParanoia) < 1) {
                throw new Error("SJCL isn't finished seeding the RNG yet. Needs new entropy added or more mouse movement.");
            }

            return bin2hex(config.rng(bits));
        },

        // Divides a `secret` number String str expressed in radix `inputRadix` (optional, default 16)
        // into `numShares` shares, each expressed in radix `outputRadix` (optional, default to `inputRadix`),
        // requiring `threshold` number of shares to reconstruct the secret.
        // Optionally, zero-pads the secret to a length that is a multiple of padLength before sharing.
        share: function (secret, numShares, threshold, padLength) {
            var neededBits,
                subShares,
                x = new Array(numShares),
                y = new Array(numShares),
                i,
                j,
                len;

            // Security:
            // For additional security, pad in multiples of 128 bits by default.
            // A small trade-off in larger share size to help prevent leakage of information
            // about small-ish secrets and increase the difficulty of attacking them.
            padLength = padLength || 128;

            if (typeof secret !== "string") {
                throw new Error("Secret must be a string.");
            }

            if (typeof numShares !== "number" || numShares % 1 !== 0 || numShares < 2) {
                throw new Error("Number of shares must be an integer between 2 and 2^bits-1 (" + config.maxShares + "), inclusive.");
            }

            if (numShares > config.maxShares) {
                neededBits = Math.ceil(Math.log(numShares + 1) / Math.LN2);
                throw new Error("Number of shares must be an integer between 2 and 2^bits-1 (" + config.maxShares + "), inclusive. To create " + numShares + " shares, use at least " + neededBits + " bits.");
            }

            if (typeof threshold !== "number" || threshold % 1 !== 0 || threshold < 2) {
                throw new Error("Threshold number of shares must be an integer between 2 and 2^bits-1 (" + config.maxShares + "), inclusive.");
            }

            if (threshold > config.maxShares) {
                neededBits = Math.ceil(Math.log(threshold + 1) / Math.LN2);
                throw new Error("Threshold number of shares must be an integer between 2 and 2^bits-1 (" + config.maxShares + "), inclusive.  To use a threshold of " + threshold + ", use at least " + neededBits + " bits.");
            }

            if (threshold > numShares) {
                throw new Error("Threshold number of shares was " + threshold + " but must be less than or equal to the " + numShares + " shares specified as the total to generate.");
            }

            if (typeof padLength !== "number" || padLength % 1 !== 0 || padLength < 0 || padLength > 1024) {
                throw new Error("Zero-pad length must be an integer between 0 and 1024 inclusive.");
            }

            secret = "1" + hex2bin(secret); // append a 1 so that we can preserve the correct number of leading zeros in our secret
            secret = splitNumStringToIntArray(secret, padLength);

            for (i = 0, len = secret.length; i < len; i++) {
                subShares = getShares(secret[i], numShares, threshold);
                for (j = 0; j < numShares; j++) {
                    x[j] = x[j] || subShares[j].x.toString(config.radix);
                    y[j] = padLeft(subShares[j].y.toString(2)) + (y[j] || "");
                }
            }

            for (i = 0; i < numShares; i++) {
                x[i] = constructPublicShareString(config.bits, x[i], bin2hex(y[i]));
            }

            return x;
        },

        // Generate a new share with id `id` (a number between 1 and 2^bits-1)
        // `id` can be a Number or a String in the default radix (16)
        newShare: function (id, shares) {
            var share;

            if (id && typeof id === "string") {
                id = parseInt(id, config.radix);
            }

            if (id && shares && shares[0]) {
                share = this.extractShareComponents(shares[0]);
                return constructPublicShareString(share.bits, id, this.combine(shares, id));
            }

            throw new Error("Invalid 'id' or 'shares' Array argument to newShare().");
        },

        /* test-code */
        // export private functions so they can be unit tested directly.
        _reset: reset,
        _padLeft: padLeft,
        _hex2bin: hex2bin,
        _bin2hex: bin2hex,
        _getRNG: getRNG,
        _isSetRNG: isSetRNG,
        _splitNumStringToIntArray: splitNumStringToIntArray,
        _horner: horner,
        _lagrange: lagrange,
        _getShares: getShares,
        _constructPublicShareString: constructPublicShareString
        /* end-test-code */

    };

    // Always initialize secrets with default settings.
    secrets.init();

    return secrets;

}));
