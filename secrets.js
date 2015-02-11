// secrets.js - by Alexander Stetsyuk - released under MIT License
/*jslint passfail: false, bitwise: true, nomen: false, plusplus: true, todo: false, maxerr: 1000 */
/*global require, module, window, Uint32Array*/

(function (exports) {

    "use strict";

    var defaults = {
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
        },
        config = {}, // Protected settings object
        preGenPadding = new Array(1024).join('0'); // Pre-generate a string of 1024 0's for use by padLeft().

    exports.init = function (bits) {
        var logs = [],
            exps = [],
            x = 1,
            primitive,
            i;

        if (bits && (typeof bits !== "number" || bits % 1 !== 0 || bits < defaults.minBits || bits > defaults.maxBits)) {
            throw new Error("Number of bits must be an integer between " + defaults.minBits + " and " + defaults.maxBits + ", inclusive.");
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

        if (!isSetRNG()) {
            this.setRNG();
        }

        if (!config.bits || !config.size || !config.maxShares || !config.logs || !config.exps || config.logs.length !== config.size || config.exps.length !== config.size) {
            throw new Error("Initialization failed.");
        }

    };

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
        missing = str.length % multipleOfBits;

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
    // which should output a random string of 1's and 0's of length `bits`
    function getRNG() {
        var crypto,
            randomBits;

        function construct(bits, arr, radix, size) {
            var i = 0,
                len,
                str = "";

            if (arr) {
                len = arr.length - 1;
            }

            while (i < len || (str.length < bits)) {
                str += padLeft(parseInt(arr[i], radix).toString(2), size);
                i++;
            }

            str = str.substr(-bits);

            if ((str.match(/0/g) || []).length === str.length) { // all zeros?
                return null;
            }

            return str;
        }

        // node.js crypto.randomBytes()
        if (typeof require === "function" && (crypto = require("crypto")) && (randomBits = crypto.randomBytes)) {
            return function (bits) {
                var bytes = Math.ceil(bits / 8),
                    str = null;

                while (str === null) {
                    str = construct(bits, randomBits(bytes).toString("hex"), 16, 4);
                }
                return str;
            };
        }

        // browsers with window.crypto.getRandomValues() and Uint32Array() support.
        if (window && window.crypto && (typeof window.crypto.getRandomValues === "function" || typeof window.crypto.getRandomValues === "object") && (typeof Uint32Array === "function" || typeof Uint32Array === "object")) {
            return function (bits) {
                var elems = Math.ceil(bits / 32),
                    str = null;

                while (str === null) {
                    str = construct(bits, window.crypto.getRandomValues(new Uint32Array(elems)), 10, 32);
                }
                return str;
            };
        }

        // Failed to find a suitable CSPRNG. All is lost.
        return null;
    }

    function isSetRNG() {
        if (config && config.rng && typeof config.rng === "function") {
            return true;
        }

        return false;
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

    function processShare(share) {
        var bits = parseInt(share[0], 36),
            max,
            idLength,
            id;

        if (bits && (typeof bits !== "number" || bits % 1 !== 0 || bits < defaults.minBits || bits > defaults.maxBits)) {
            throw new Error("Number of bits must be an integer between " + defaults.minBits + " and " + defaults.maxBits + ", inclusive.");
        }

        max = Math.pow(2, bits) - 1;
        idLength = max.toString(config.radix).length;
        id = parseInt(share.substr(1, idLength), config.radix);

        if (typeof id !== "number" || id % 1 !== 0 || id < 1 || id > max) {
            throw new Error("Share id must be an integer between 1 and " + config.maxShares + ", inclusive.");
        }

        share = share.substr(idLength + 1);

        if (!share.length) {
            throw new Error("Invalid share: zero-length share.");
        }

        return {
            "bits": bits,
            "id": id,
            "value": share
        };
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

    // Evaluates the Lagrange interpolation polynomial at x=`at` for
    // individual config.bits-length segments of each share in the `shares`
    // Array. Each share is expressed in base `inputRadix`. The output
    // is expressed in base `outputRadix'.
    exports.combine = function (shares, at) {
        var setBits,
            share,
            x = [],
            y = [],
            result = "",
            idx,
            i,
            len,
            len2,
            j;

        at = at || 0;

        for (i = 0, len = shares.length; i < len; i++) {
            share = processShare(shares[i]);
            if (setBits === undefined) {
                setBits = share.bits;
            } else if (share.bits !== setBits) {
                throw new Error("Mismatched shares: Different bit settings.");
            }

            if (config.bits !== setBits) {
                this.init(setBits);
            }

            // Check if this share.id is already in the Array
            if (x.indexOf(share.id) === -1) {
                idx = x.push(share.id) - 1;
                share = splitNumStringToIntArray(hex2bin(share.value));

                for (j = 0, len2 = share.length; j < len2; j++) {
                    y[j] = y[j] || [];
                    y[j][idx] = share[j];
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

        // generating a new share
        return bin2hex(result);
    };

    exports.getConfig = function () {
        var obj = {};
        obj.radix = config.radix;
        obj.bits = config.bits;
        obj.maxShares = config.maxShares;
        obj.hasCSPRNG = isSetRNG();
        return obj;
    };

    // Given a public share, extract the bits (Integer), share ID (Integer), and share data (Hex)
    // and return an Object containing those components.
    exports.extractShareComponents = function (share) {
        var bits,
            id,
            idLen,
            obj = {},
            regexStr,
            shareComponents;

        // Extract the first char which represents the bits in Base 36
        bits = parseInt(share.substr(0, 1), 36);

        // Determine the ID length which is variable and based on the bit count.
        idLen = (Math.pow(2, bits) - 1).toString(16).length;

        // Extract all the parts now that the segment sizes are known.
        regexStr = "^([a-kA-K3-9]{1})([a-fA-F0-9]{" + idLen + "})([a-fA-F0-9]+)$";
        shareComponents = new RegExp(regexStr).exec(share);

        // The ID is a Hex number and needs to be converted to an Integer
        if (shareComponents) {
            id = parseInt(shareComponents[2], 16);
        }

        if (bits && bits >= defaults.minBits && bits <= defaults.maxBits && id && id >= 1 && shareComponents && shareComponents[3]) {
            obj.bits = bits;
            obj.id = id;
            obj.data = shareComponents[3];
            return obj;
        }

        throw new Error("The share provided is invalid : " + share);

    };

    // Set the PRNG to use. If no RNG function is supplied, pick a default using getRNG()
    exports.setRNG = function (rng) {

        var errPrefix = "Random number generator is invalid ",
            errSuffix = " Supply an CSPRNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.";

        if (!rng) {
            rng = getRNG();
        }

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

        config.rng = rng;

        return true;
    };

    // Converts a given UTF16 character string to the HEX representation.
    // Each character of the input string is represented by
    // `bytesPerChar` bytes in the output string which defaults to 2.
    exports.str2hex = function (str, bytesPerChar) {
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
    };

    // Converts a given HEX number string to a UTF16 character string.
    exports.hex2str = function (str, bytesPerChar) {
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
    };

    // Generates a random bits-length number string using the PRNG
    exports.random = function (bits) {
        if (typeof bits !== "number" || bits % 1 !== 0 || bits < 2 || bits > 65536) {
            throw new Error("Number of bits must be an Integer between 1 and 65536.");
        }

        return bin2hex(config.rng(bits));
    };

    // Divides a `secret` number String str expressed in radix `inputRadix` (optional, default 16)
    // into `numShares` shares, each expressed in radix `outputRadix` (optional, default to `inputRadix`),
    // requiring `threshold` number of shares to reconstruct the secret.
    // Optionally, zero-pads the secret to a length that is a multiple of padLength before sharing.
    exports.share = function (secret, numShares, threshold, padLength) {
        var neededBits,
            padding,
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

        padding = config.maxShares.toString(config.radix).length;

        for (i = 0; i < numShares; i++) {
            x[i] = config.bits.toString(36).toUpperCase() + padLeft(x[i], padding) + bin2hex(y[i]);
        }

        return x;
    };

    // Generate a new share with id `id` (a number between 1 and 2^bits-1)
    // `id` can be a Number or a String in the default radix (16)
    exports.newShare = function (id, shares) {
        var share,
            max,
            padding;

        if (typeof id === "string") {
            id = parseInt(id, config.radix);
        }

        share = processShare(shares[0]);
        max = Math.pow(2, share.bits) - 1;

        if (typeof id !== "number" || id % 1 !== 0 || id < 1 || id > max) {
            throw new Error("Share id must be an integer between 1 and " + config.maxShares + ", inclusive.");
        }

        padding = max.toString(config.radix).length;
        return config.bits.toString(36).toUpperCase() + padLeft(id.toString(config.radix), padding) + this.combine(shares, id);
    };

    /* test-code */
    // export private functions so they can be unit tested directly.
    exports._padLeft = padLeft;
    exports._hex2bin = hex2bin;
    exports._bin2hex = bin2hex;
    exports._getRNG = getRNG;
    exports._isSetRNG = isSetRNG;
    exports._splitNumStringToIntArray = splitNumStringToIntArray;
    exports._horner = horner;
    exports._processShare = processShare;
    exports._lagrange = lagrange;
    exports._getShares = getShares;
    /* end-test-code */

    // Always initialize secrets with default settings.
    secrets.init();

})(typeof module !== "undefined" && module.exports ? module.exports : (window.secrets = {}));
