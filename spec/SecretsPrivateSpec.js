/*jslint passfail: false, bitwise: true, todo: false, maxerr: 1000 */
/*global secrets, describe, xdescribe, it, xit, expect, beforeEach, afterEach, Uint32Array */

describe("Secrets private function", function () {

    "use strict";

    describe("padLeft()", function () {

        beforeEach(function () {
        });

        xit("with an empty arg, which should be 8 bits", function () {
            secrets.init();
            expect(secrets.getConfig().bits).toEqual(8);
            expect(secrets.combine(secrets.share(key, 3, 2))).toEqual(key);
        });


        xit("unless the arg is a number less than 3", function () {
            expect(function () {
                secrets.init(2);
            }).toThrowError("Number of bits must be an integer between 3 and 20, inclusive.");
        });

    });

    describe("hex2bin()", function () {
    });

    describe("bin2hex()", function () {
    });

    describe("isInited()", function () {
    });

    describe("getRNG()", function () {
    });

    describe("isSetRNG()", function () {
    });

    describe("split()", function () {
    });

    describe("horner()", function () {
    });

    describe("inArray()", function () {
    });

    describe("processShare()", function () {
    });

    describe("lagrange()", function () {
    });

    describe("getShares()", function () {
    });

    describe("combine()", function () {
    });

});
