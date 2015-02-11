/*jslint passfail: false, bitwise: true, todo: false, maxerr: 1000 */
/*global secrets, describe, xdescribe, it, xit, expect, beforeEach, afterEach, Uint32Array */

describe("Secrets private function", function () {

    "use strict";

    describe("padLeft()", function () {

        beforeEach(function () {
            secrets.init();
        });

        it("without specifying bits of padding it should default to config.bits", function () {
            secrets.init(10);
            var str = "abc123";
            expect(secrets._padLeft(str)).toEqual("0000abc123");
            expect(secrets._padLeft(str).length).toEqual(10);
        });

        it("with null bits of padding it should default to config.bits", function () {
            secrets.init(10);
            var str = "abc123";
            expect(secrets._padLeft(str, null)).toEqual("0000abc123");
            expect(secrets._padLeft(str, null).length).toEqual(10);
        });

        it("with zero bits of padding", function () {
            var str = "abc123";
            expect(secrets._padLeft(str, 0)).toEqual("abc123");
            expect(secrets._padLeft(str, 0).length).toEqual(6);
        });

        it("with 1 bit of padding", function () {
            var str = "abc123";
            expect(secrets._padLeft(str, 1)).toEqual("abc123");
            expect(secrets._padLeft(str, 1).length).toEqual(6);
        });

        it("with a value that is shorter than bits", function () {
            var str = "abc123";
            expect(secrets._padLeft(str, 32)).toEqual("00000000000000000000000000abc123");
            expect(secrets._padLeft(str, 32).length).toEqual(32);
        });

        it("with a value that is equal in size to bits", function () {
            var str = "01234567890123456789012345678901";
            expect(secrets._padLeft(str, 32)).toEqual("01234567890123456789012345678901");
            expect(secrets._padLeft(str, 32).length).toEqual(32);
        });

        it("with a value that is larger than bits", function () {
            var str = "0123456789012345678901234567890123456789";
            expect(secrets._padLeft(str, 32)).toEqual("0000000000000000000000000123456789012345678901234567890123456789");
            expect(secrets._padLeft(str, 32).length).toEqual(64);
        });

        it("with bits set to the max of 1024", function () {
            var str = "0123456789012345678901234567890123456789";
            expect(secrets._padLeft(str, 1024).length).toEqual(1024);
        });

        it("unless bits set greater than the max of 1024", function () {
            expect(function () {
                secrets._padLeft("abc123", 1025);
            }).toThrowError("Padding must be multiples of no larger than 1024 bits.");
        });

    });

    describe("hex2bin()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("bin2hex()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("isInited()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("getRNG()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("isSetRNG()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("split()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("horner()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("processShare()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("lagrange()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

    describe("getShares()", function () {

        beforeEach(function () {
            secrets.init();
        });

    });

});
