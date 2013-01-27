// secrets.js - Copyright (c) 2012 Alexander Stetsyuk
(function(exports, global){
var defaults = {
	bits: 8, // default number of bits
	radix: 16, // work with HEX strings by default
	minBits: 3,
	maxBits: 20, // this permits 1,048,575 shares, though going this high is NOT recommended in JS!
	
	bytesPerChar: 2,
	maxBytesPerChar: 6, // Math.pow(256,7) > Math.pow(2,53)
		
	// Primitive polynomials (in decimal form) for Galois Fields GF(2^n), for 2 <= n <= 30
	// The index of each term in the array corresponds to the n for that polynomial
	// i.e. to get the polynomial for n=16, use primitivePolynomials[16]
	primitivePolynomials: [null,null,1,3,3,5,3,3,29,17,9,5,83,27,43,3,45,9,39,39,9,5,3,33,27,9,71,39,9,5,83],
	
	// warning for insecure PRNG
	warning: 'WARNING:\nA secure random number generator was not found.\nUsing Math.random(), which is NOT cryptographically strong!'
};

// Protected settings object
var config = {};

/** @expose **/
exports.getConfig = function(){
	return {'bits': config.bits};
};

function init(bits){
	if(bits && (typeof bits !== 'number' || bits%1 !== 0 || bits<defaults.minBits || bits>defaults.maxBits)){
		throw new Error('Number of bits must be an integer between ' + defaults.minBits + ' and ' + defaults.maxBits + ', inclusive.')
	}

	config.bits = bits || defaults.bits;
	config.size = Math.pow(2, config.bits);
	config.max = config.size - 1;
	
	// Construct the exp and log tables for multiplication.	
	var logs = [], exps = [], x = 1, primitive = defaults.primitivePolynomials[config.bits];
	for(var i=0; i<config.size; i++){
		exps[i] = x;
		logs[x] = i;
		x <<= 1;
		if(x >= config.size){
			x ^= primitive;
			x &= config.max;
		}
	}
		
	config.logs = logs;
	config.exps = exps;
};

/** @expose **/
exports.init = init;

function isInited(){
	if(!config.bits || !config.size || !config.max  || !config.logs || !config.exps || config.logs.length !== config.size || config.exps.length !== config.size){
		return false;
	}
	return true;
};

// Returns a pseudo-random number generator of the form function(bits){}
// which should output a random string of 1's and 0's of length `bits`
function getRNG(){
	var randomBits, crypto;
	
	function construct(bits, arr, radix, size){
		var str = '',
			i = 0,
			len = arr.length-1;
		while( i<len || (str.length < bits) ){
			str += padLeft(parseInt(arr[i], radix).toString(2), size);
			i++;
		}
		str = str.substr(-bits);
		if( (str.match(/0/g)||[]).length === str.length){ // all zeros?
			return null;
		}else{
			return str;
		}
	}
	
	// node.js crypto.randomBytes()
	if(typeof require === 'function' && (crypto=require('crypto')) && (randomBits=crypto['randomBytes'])){
		return function(bits){
			var bytes = Math.ceil(bits/8),
				str = null;
		
			while( str === null ){
				str = construct(bits, randomBits(bytes).toString('hex'), 16, 4);
			}
			return str;
		}
	}
	
	// browsers with window.crypto.getRandomValues()
	if(global['crypto'] && typeof global['crypto']['getRandomValues'] === 'function' && typeof global['Uint32Array'] === 'function'){
		crypto = global['crypto'];
		return function(bits){
			var elems = Math.ceil(bits/32),
				str = null,
				arr = new global['Uint32Array'](elems);

			while( str === null ){
				crypto['getRandomValues'](arr);
				str = construct(bits, arr, 10, 32);
			}
			
			return str;	
		}
	}

	// A totally insecure RNG!!! (except in Safari)
	// Will produce a warning every time it is called.
	config.unsafePRNG = true;
	warn();
	
	var bitsPerNum = 32;
	var max = Math.pow(2,bitsPerNum)-1;
	return function(bits){
		var elems = Math.ceil(bits/bitsPerNum);
		var arr = [], str=null;
		while(str===null){
			for(var i=0; i<elems; i++){
				arr[i] = Math.floor(Math.random() * max + 1); 
			}
			str = construct(bits, arr, 10, bitsPerNum);
		}
		return str;
	};
};

// Warn about using insecure rng.
// Called when Math.random() is being used.
function warn(){
	global['console']['warn'](defaults.warning);
	if(typeof global['alert'] === 'function'){
		global['alert'](defaults.warning);
	}
}

// Set the PRNG to use. If no RNG function is supplied, pick a default using getRNG()
/** @expose **/
exports.setRNG = function(rng){
	if(!isInited()){
		this.init();
	}
	
	rng = rng || getRNG();
	
	// test the RNG (5 times)
	if(typeof rng !== 'function' || typeof rng(config.bits) !== 'string' || !parseInt(rng(config.bits),2) || rng(config.bits).length > config.bits || rng(config.bits).length < config.bits){
		throw new Error("Random number generator is invalid. Supply an RNG of the form function(bits){} that returns a string containing 'bits' number of random 1's and 0's.")
	}else{
		config.rng = rng;
	}
};

function isSetRNG(){
	return typeof config.rng === 'function'; 
};

// Generates a random bits-length number string using the PRNG
/** @expose **/
exports.random = function(bits){
	if(!isSetRNG()){
		this.setRNG();
	}
	
	if(typeof bits !== 'number' || bits%1 !== 0 || bits < 2){
		throw new Error('Number of bits must be an integer greater than 1.')
	}
	
	if(config.unsafePRNG){
		warn();
	}
	return this.convertBase(config.rng(bits), 2, 16);
}

// Divides a `secret` number String str expressed in radix `inputRadix` (optional, default 16) 
// into `numShares` shares, each expressed in radix `outputRadix` (optional, default to `inputRadix`), 
// requiring `threshold` number of shares to reconstruct the secret. 
// Optionally, zero-pads the secret to a length that is a multiple of padLength before sharing.
/** @expose **/
exports.share = function(secret, numShares, threshold, inputRadix, outputRadix, padLength){
	if(!isInited()){
		this.init();
	}
	if(!isSetRNG()){
		this.setRNG();
	}
	
	padLength =  padLength || 0;
	inputRadix = inputRadix || defaults.radix;
	outputRadix = outputRadix || defaults.radix;
		
	if(typeof secret !== 'string'){
		throw new Error('Secret must be a string.');
	}
	if(typeof inputRadix !== 'number' || inputRadix%1 !== 0 /*test if integer*/ || inputRadix < 2 || inputRadix > 36){
		throw new Error('Input radix must be an integer between 2 and 36, inclusive.');
	}
	if(typeof outputRadix !== 'number' || outputRadix%1 !== 0 || outputRadix < 2 || outputRadix > 36){
		throw new Error('Output radix must be an integer between 2 and 36, inclusive.');
	}
	if(typeof numShares !== 'number' || numShares%1 !== 0 || numShares < 2){
		throw new Error('Number of shares must be an integer between 2 and 2^bits-1 (' + config.max + '), inclusive.')
	}
	if(numShares > config.max){
		var neededBits = Math.ceil(Math.log(numShares +1)/Math.log(2));
		throw new Error('Number of shares must be an integer between 2 and 2^bits-1 (' + config.max + '), inclusive. To create ' + numShares + ' shares, use at least ' + neededBits + ' bits.')	
	}
	if(typeof threshold !== 'number' || threshold%1 !== 0 || threshold < 2){
		throw new Error('Threshold number of shares must be an integer between 2 and 2^bits-1 (' + config.max + '), inclusive.');
	}
	if(threshold > config.max){
		var neededBits = Math.ceil(Math.log(threshold +1)/Math.log(2));
		throw new Error('Threshold number of shares must be an integer between 2 and 2^bits-1 (' + config.max + '), inclusive.  To use a threshold of ' + threshold + ', use at least ' + neededBits + ' bits.');
	}
	if(typeof padLength !== 'number' || padLength%1 !== 0 ){
		throw new Error('Zero-pad length must be an integer greater than 1.');
	}
	
	if(config.unsafePRNG){
		warn();
	}
	
	secret = split(secret, inputRadix, padLength);	
	var x = new Array(numShares), y = new Array(numShares);
	for(var i=0, len = secret.length; i<len; i++){
		var subShares = this._getShares(secret[i], numShares, threshold);
		for(var j=0; j<numShares; j++){
			x[j] = x[j] || subShares[j].x.toString(outputRadix);
			y[j] = padLeft(subShares[j].y.toString(2)) + (y[j] ? y[j] : '');
		}
	}
	var padding = config.max.toString(outputRadix).length;
	for(var i=0; i<numShares; i++){
		x[i] = config.bits.toString(36) + padLeft(x[i],padding) + new BigInteger(y[i], 2).toString(outputRadix);
	}
		
	return x;
};
	
// Splits a number string `str` in base `radix` into `bits`-length segments, after 
// first optionally zero-padding it to a length that is a multiple of padLength.
// Returns array of integers (each less than 2^bits-1), with each element
// representing a `bits`-length segment of the input string from right to left, 
// i.e. parts[0] represents the right-most `bits`-length segment of the input string.

function split(str, radix, padLength){
	str = new BigInteger(str, radix).toString(2);
	if(padLength){
		str = padLeft(str, padLength)
	}
	var parts = [];
	for(var i=str.length; i>config.bits; i-=config.bits){
		parts.push(parseInt(str.slice(i-config.bits, i), 2));
	}	
	parts.push(parseInt(str.slice(0, i), 2));
		
	return parts;
};
	
// Pads a string `str` with zeros on the left so that its length is a multiple of `bits`
function padLeft(str, bits){
	bits = bits || config.bits
	var missing = str.length % bits;
	return (missing ? new Array(bits - missing + 1).join('0') : '') + str;
};
	
// This is the basic polynomial generation and evaluation function 
// for a `bits` length secret (NOT an arbitrary length)
// Note: no error-checking! If `secrets` is NOT a NUMBER less than 
// 2^bits-1, the output will be incorrect!
/** @expose **/
exports._getShares = function(secret, numShares, threshold){	
	var shares = [];
	var coeffs = [secret]; 
		
	for(var i=1; i<threshold; i++){
		coeffs[i] = parseInt(config.rng(config.bits),2);
	}
	for(var i=1, len = numShares+1; i<len; i++){
		shares[i-1] = {
			x: i,
			y: horner(i, coeffs)
		}
	}
	return shares;
};
	
// polynomial evaluation at `x` using Horner's Method
// TODO: this can possibly be sped up using other methods
// NOTE: fx=fx * x + coeff[i] ->  exp(log(fx) + log(x)) + coeff[i], 
//       so if fx===0, just set fx to coeff[i] because
//       (using the exp/log form will result in incorrect value)
function horner(x, coeffs){
	var logx = config.logs[x];
	var fx = 0;
	for(var i=coeffs.length-1; i>=0; i--){	
		if(fx === 0){
			fx = coeffs[i];
			continue;
		}
		fx = config.exps[ (logx + config.logs[fx]) % config.max ] ^ coeffs[i];
	}
	return fx;
};
	
// Generate a new share with id `id` (a number between 1 and 2^bits-1)
// using previously generated `shares` in base `radix`.
// `id` can be a Number or a String in radix `radix`
/** @expose **/
exports.newShare = function(id, shares, radix){
	radix = radix || defaults.radix;
	
	if(typeof radix !== 'number' || radix%1 !== 0 /*test if integer*/ || radix < 2 || radix > 36){
		throw new Error('Radix must be an integer between 2 and 36, inclusive.');
	}
	if(typeof id === 'string'){
		id = parseInt(id, radix);	
	}
	
	var share = processShare(shares[0], radix);
	var max = Math.pow(2, share.bits) - 1;
	
	if(typeof id !== 'number' || id%1 !== 0 || id<1 || id>max){
		throw new Error('Share id must be an integer between 1 and ' + config.max + ', inclusive.');
	}

	var padding = max.toString(radix).length;
	return config.bits.toString(36) + padLeft(id.toString(radix), padding) + combine(id, shares, radix, radix);
};

function inArray(arr,val){
	for(var i = 0,len=arr.length; i < len; i++) {
		if(arr[i] === val){
   		 return true;
	 	}
 	}
	return false;
};


function processShare(share, radix){
	radix = radix || defaults.radix;
	
	var bits = parseInt(share[0], 36);
	if(bits && (typeof bits !== 'number' || bits%1 !== 0 || bits<defaults.minBits || bits>defaults.maxBits)){
		throw new Error('Number of bits must be an integer between ' + defaults.minBits + ' and ' + defaults.maxBits + ', inclusive.')
	}
	
	var max = Math.pow(2, bits) - 1;
	var idLength = max.toString(radix).length;
	
	var id = parseInt(share.substr(1, idLength), radix);
	if(typeof id !== 'number' || id%1 !== 0 || id<1 || id>max){
		throw new Error('Share id must be an integer between 1 and ' + config.max + ', inclusive.');
	}
	share = share.substr(idLength + 1);
	if(!share.length){
		throw new Error('Invalid share: zero-length share.')
	}
	return {
		bits: bits,
		id: id,
		share: share
	};
};

/** @expose **/
secrets._processShare = processShare;

// Protected method that evaluates the Lagrange interpolation
// polynomial at x=`at` for individual config.bits-length
// segments of each share in the `shares` Array.
// Each share is expressed in base `inputRadix`. The output 
// is expressed in base `outputRadix'
function combine(at, shares, inputRadix, outputRadix){
	var setBits, share, x = [], y = [], result = '', idx;	
	
	for(var i=0, len = shares.length; i<len; i++){
		share = processShare(shares[i], inputRadix);
		if(typeof setBits === 'undefined'){
			setBits = share.bits;
		}else if(share.bits !== setBits){
			throw new Error('Mismatched shares: Different bit settings.')
		}
		
		if(config.bits !== setBits){
			init(setBits);
		}
		
		if(inArray(x, share.id)){ // repeated x value?
			continue;
		}
	
		idx = x.push(share.id) - 1;
		share = split(share.share, inputRadix);
		for(var j=0, len2 = share.length; j<len2; j++){
			y[j] = y[j] || [];
			y[j][idx] = share[j];
		}
	}
	
	for(var i=0, len=y.length; i<len; i++){
		result = padLeft(lagrange(at, x, y[i]).toString(2)) + result;
	}
	return new BigInteger(result, 2).toString(outputRadix);
};

// Combine `shares` Array in radix `radix` into the original secret
/** @expose **/
exports.combine = function(shares, inputRadix, outputRadix){
	inputRadix = inputRadix || defaults.radix;
	outputRadix = outputRadix || defaults.radix;
	
	if(typeof inputRadix !== 'number' || inputRadix%1 !== 0 /*test if integer*/ || inputRadix < 2 || inputRadix > 36){
		throw new Error('Input radix must be an integer between 2 and 36, inclusive.');
	}
	if(typeof outputRadix !== 'number' || outputRadix%1 !== 0 /*test if integer*/ || outputRadix < 2 || outputRadix > 36){
		throw new Error('Output radix must be an integer between 2 and 36, inclusive.');
	}
	
	return combine(0, shares, inputRadix, outputRadix);
};
	
// Evaluate the Lagrange interpolation polynomial at x = `at`
// using x and y Arrays that are of the same length, with
// corresponding elements constituting a point on the polynomial.
function lagrange(at, x, y){
	var sum = 0,
		product, 
		i, j;
		
	for(var i=0, len = x.length; i<len; i++){
		if(!y[i]){
			continue; 
		}
			
		product = config.logs[y[i]];
		for(var j=0; j<len; j++){
			if(i === j){ continue; }
			if(at === x[j]){ // happens when computing a share that is in the list of shares used to compute it
				product = -1; // fix for a zero product term, after which the sum should be sum^0 = sum, not sum^1
				break; 
			}
			product = ( product + config.logs[at ^ x[j]] - config.logs[x[i] ^ x[j]] + config.max/* to make sure it's not negative */ ) % config.max;
		}
			
		sum = product === -1 ? sum : sum ^ config.exps[product]; // though exps[-1]= undefined and undefined ^ anything = anything in chrome, this behavior may not hold everywhere, so do the check
	}
	return sum;
};

/** @expose **/
exports._lagrange = lagrange;
	
// Converts a given character string to the HEX representation. 
// Each character of the input string is represented by 
// `bytesPerChar` bytes in the output string.
/** @expose **/
exports.toHex = function(str, bytesPerChar){
	if(typeof str !== 'string'){
		throw new Error('Input must be a character string.');
	}
	bytesPerChar = bytesPerChar || defaults.bytesPerChar;
	
	if(typeof bytesPerChar !== 'number' || bytesPerChar%1 !== 0 || bytesPerChar<1 || bytesPerChar > defaults.maxBytesPerChar){
		throw new Error('Bytes per character must be an integer between 1 and ' + defaults.maxBytesPerChar + ', inclusive.')
	}
	
	var hexChars = 2*bytesPerChar
	var max = Math.pow(16, hexChars) - 1;
	var out = '', num;
	for(var i=0, len=str.length; i<len; i++){
		num = str[i].charCodeAt();
		if(isNaN(num)){
			throw new Error('Invalid character: ' + str[i]);
		}else if(num > max){
			var neededBytes = Math.ceil(Math.log(num+1)/Math.log(256));
			throw new Error('Invalid character code (' + num +'). Maximum allowable is 256^bytes-1 (' + max + '). To convert this character, use at least ' + neededBytes + ' bytes.')
		}else{
			out = padLeft(num.toString(16), hexChars) + out;
		}
	}
	return out;
};
	
// Converts a given HEX number string to a character string. 
/** @expose **/
exports.toString = function(str, bytesPerChar){
	if(typeof str !== 'string'){
		throw new Error('Input must be a hexadecimal string.');
	}
	bytesPerChar = bytesPerChar || defaults.bytesPerChar;
	
	if(typeof bytesPerChar !== 'number' || bytesPerChar%1 !== 0 || bytesPerChar<1 || bytesPerChar > defaults.maxBytesPerChar){
		throw new Error('Bytes per character must be an integer between 1 and ' + defaults.maxBytesPerChar + ', inclusive.')
	}
	
	var hexChars = 2*bytesPerChar;
	var out = '';
	str = padLeft(str, hexChars);
	for(var i=0, len = str.length; i<len; i+=hexChars){
		out = String.fromCharCode(parseInt(str.slice(i, i+hexChars),16)) + out;
	}
	return out;
};
	
// Converts a number string in base `inputRadix` to a number string with base `outputRadix`
/** @expose **/
exports.convertBase = function(str, inputRadix, outputRadix){
	if(typeof str !== 'string'){
		throw new Error('Input must be a number string.');
	}
	if(typeof inputRadix !== 'number' || inputRadix%1 !== 0 || inputRadix < 2 || inputRadix > 36){
		throw new Error('Input radix must be an integer between 2 and 36, inclusive.');
	}
	if(typeof outputRadix !== 'number' || outputRadix%1 !== 0 || outputRadix < 2 || outputRadix > 36){
		throw new Error('Output radix must be an integer between 2 and 36, inclusive.');
	}
	return new BigInteger(str, inputRadix).toString(outputRadix);
};

// by default, initialize without an RNG
exports.init();




// Modified subset of JSBN useful for base conversion of strings of different radices
// The constructor has been modified to NOT generate primes or random BigIntegers

/*
 * Copyright (c) 2003-2005  Tom Wu
 * All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
 * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
 *
 * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
 * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
 * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
 * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * In addition, the following condition applies:
 *
 * All redistributions must retain an intact copy of this copyright notice
 * and disclaimer.
 */
 
 /** @constructor */
function BigInteger(a,b,c) {
  if(a != null)
    //if("number" == typeof a) this.fromNumber(a,b,c);
    //else if(b == null && "string" != typeof a) this.fromString(a,256);
	if(b == null && "string" != typeof a) this.fromString(a,256);
    else this.fromString(a,b);
}

BigInteger.prototype = {
	fromString: function bnpFromString(s,b) {
	  var k;
	  if(b == 16) k = 4;
	  else if(b == 8) k = 3;
	  else if(b == 256) k = 8; // byte array
	  else if(b == 2) k = 1;
	  else if(b == 32) k = 5;
	  else if(b == 4) k = 2;
	  else { this.fromRadix(s,b); return; }
	  this.t = 0;
	  this.s = 0;
	  var i = s.length, mi = false, sh = 0;
	  while(--i >= 0) {
	    var x = (k==8)?s[i]&0xff:intAt(s,i);
	    if(x < 0) {
	      if(s.charAt(i) == "-") mi = true;
	      continue;
	    }
	    mi = false;
	    if(sh == 0)
	      this[this.t++] = x;
	    else if(sh+k > this.DB) {
	      this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
	      this[this.t++] = (x>>(this.DB-sh));
	    }
	    else
	      this[this.t-1] |= x<<sh;
	    sh += k;
	    if(sh >= this.DB) sh -= this.DB;
	  }
	  if(k == 8 && (s[0]&0x80) != 0) {
	    this.s = -1;
	    if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
	  }
	  this.clamp();
	  if(mi) BigInteger.ZERO.subTo(this,this);
	},
	fromRadix: function bnpFromRadix(s,b) {
	  this.fromInt(0);
	  if(b == null) b = 10;
	  var cs = this.chunkSize(b);
	  var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
	  for(var i = 0; i < s.length; ++i) {
	    var x = intAt(s,i);
	    if(x < 0) {
	      if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
	      continue;
	    }
	    w = b*w+x;
	    if(++j >= cs) {
	      this.dMultiply(d);
	      this.dAddOffset(w,0);
	      j = 0;
	      w = 0;
	    }
	  }
	  if(j > 0) {
	    this.dMultiply(Math.pow(b,j));
	    this.dAddOffset(w,0);
	  }
	  if(mi) BigInteger.ZERO.subTo(this,this);
	},
	fromInt: function bnpFromInt(x) {
	  this.t = 1;
	  this.s = (x<0)?-1:0;
	  if(x > 0) this[0] = x;
	  else if(x < -1) this[0] = x+DV;
	  else this.t = 0;
	},
	chunkSize: function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); },
	dMultiply: function bnpDMultiply(n) {
	  this[this.t] = this.am(0,n-1,this,0,0,this.t);
	  ++this.t;
	  this.clamp();
	},
	clamp: function bnpClamp() {
	  var c = this.s&this.DM;
	  while(this.t > 0 && this[this.t-1] == c) --this.t;
	},
	dAddOffset: function bnpDAddOffset(n,w) {
	  if(n == 0) return;
	  while(this.t <= w) this[this.t++] = 0;
	  this[w] += n;
	  while(this[w] >= this.DV) {
	    this[w] -= this.DV;
	    if(++w >= this.t) this[this.t++] = 0;
	    ++this[w];
	  }
	},
	toString: function bnToString(b) {
	  if(this.s < 0) return "-"+this.negate().toString(b);
	  var k;
	  if(b == 16) k = 4;
	  else if(b == 8) k = 3;
	  else if(b == 2) k = 1;
	  else if(b == 32) k = 5;
	  else if(b == 4) k = 2;
	  else return this.toRadix(b);
	  var km = (1<<k)-1, d, m = false, r = "", i = this.t;
	  var p = this.DB-(i*this.DB)%k;
	  if(i-- > 0) {
	    if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
	    while(i >= 0) {
	      if(p < k) {
	        d = (this[i]&((1<<p)-1))<<(k-p);
	        d |= this[--i]>>(p+=this.DB-k);
	      }
	      else {
	        d = (this[i]>>(p-=k))&km;
	        if(p <= 0) { p += this.DB; --i; }
	      }
	      if(d > 0) m = true;
	      if(m) r += int2char(d);
	    }
	  }
	  return m?r:"0";
	},
	toRadix: function bnpToRadix(b) {
	  if(b == null) b = 10;
	  if(this.signum() == 0 || b < 2 || b > 36) return "0";
	  var cs = this.chunkSize(b);
	  var a = Math.pow(b,cs);
	  var d = nbv(a), y = nbi(), z = nbi(), r = "";
	  this.divRemTo(d,y,z);
	  while(y.signum() > 0) {
	    r = (a+z.intValue()).toString(b).substr(1) + r;
	    y.divRemTo(d,y,z);
	  }
	  return z.intValue().toString(b) + r;
	},
	divRemTo: function bnpDivRemTo(m,q,r) {
	  var pm = m.abs();
	  if(pm.t <= 0) return;
	  var pt = this.abs();
	  if(pt.t < pm.t) {
	    if(q != null) q.fromInt(0);
	    if(r != null) this.copyTo(r);
	    return;
	  }
	  if(r == null) r = nbi();
	  var y = nbi(), ts = this.s, ms = m.s;
	  var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
	  if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
	  else { pm.copyTo(y); pt.copyTo(r); }
	  var ys = y.t;
	  var y0 = y[ys-1];
	  if(y0 == 0) return;
	  var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
	  var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
	  var i = r.t, j = i-ys, t = (q==null)?nbi():q;
	  y.dlShiftTo(j,t);
	  if(r.compareTo(t) >= 0) {
	    r[r.t++] = 1;
	    r.subTo(t,r);
	  }
	  BigInteger.ONE.dlShiftTo(ys,t);
	  t.subTo(y,y);	// "negative" y so we can replace sub with am later
	  while(y.t < ys) y[y.t++] = 0;
	  while(--j >= 0) {
	    // Estimate quotient digit
	    var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
	    if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
	      y.dlShiftTo(j,t);
	      r.subTo(t,r);
	      while(r[i] < --qd) r.subTo(t,r);
	    }
	  }
	  if(q != null) {
	    r.drShiftTo(ys,q);
	    if(ts != ms) BigInteger.ZERO.subTo(q,q);
	  }
	  r.t = ys;
	  r.clamp();
	  if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
	  if(ts < 0) BigInteger.ZERO.subTo(r,r);
	},
	signum: function bnSigNum() {
	  if(this.s < 0) return -1;
	  else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
	  else return 1;
	},
	abs: function bnAbs() { return (this.s<0)?this.negate():this; },
	compareTo: function bnCompareTo(a) {
	  var r = this.s-a.s;
	  if(r != 0) return r;
	  var i = this.t;
	  r = i-a.t;
	  if(r != 0) return (this.s<0)?-r:r;
	  while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
	  return 0;
	},
	dlShiftTo: function bnpDLShiftTo(n,r) {
	  var i;
	  for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
	  for(i = n-1; i >= 0; --i) r[i] = 0;
	  r.t = this.t+n;
	  r.s = this.s;
	},
	drShiftTo: function bnpDRShiftTo(n,r) {
	  for(var i = n; i < this.t; ++i) r[i-n] = this[i];
	  r.t = Math.max(this.t-n,0);
	  r.s = this.s;
	},
	lShiftTo: function bnpLShiftTo(n,r) {
	  var bs = n%this.DB;
	  var cbs = this.DB-bs;
	  var bm = (1<<cbs)-1;
	  var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
	  for(i = this.t-1; i >= 0; --i) {
	    r[i+ds+1] = (this[i]>>cbs)|c;
	    c = (this[i]&bm)<<bs;
	  }
	  for(i = ds-1; i >= 0; --i) r[i] = 0;
	  r[ds] = c;
	  r.t = this.t+ds+1;
	  r.s = this.s;
	  r.clamp();
	},
	rShiftTo: function bnpRShiftTo(n,r) {
	  r.s = this.s;
	  var ds = Math.floor(n/this.DB);
	  if(ds >= this.t) { r.t = 0; return; }
	  var bs = n%this.DB;
	  var cbs = this.DB-bs;
	  var bm = (1<<bs)-1;
	  r[0] = this[ds]>>bs;
	  for(var i = ds+1; i < this.t; ++i) {
	    r[i-ds-1] |= (this[i]&bm)<<cbs;
	    r[i-ds] = this[i]>>bs;
	  }
	  if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
	  r.t = this.t-ds;
	  r.clamp();
	},
	subTo: function bnpSubTo(a,r) {
	  var i = 0, c = 0, m = Math.min(a.t,this.t);
	  while(i < m) {
	    c += this[i]-a[i];
	    r[i++] = c&this.DM;
	    c >>= this.DB;
	  }
	  if(a.t < this.t) {
	    c -= a.s;
	    while(i < this.t) {
	      c += this[i];
	      r[i++] = c&this.DM;
	      c >>= this.DB;
	    }
	    c += this.s;
	  }
	  else {
	    c += this.s;
	    while(i < a.t) {
	      c -= a[i];
	      r[i++] = c&this.DM;
	      c >>= this.DB;
	    }
	    c -= a.s;
	  }
	  r.s = (c<0)?-1:0;
	  if(c < -1) r[i++] = this.DV+c;
	  else if(c > 0) r[i++] = c;
	  r.t = i;
	  r.clamp();
	},
	copyTo: function bnpCopyTo(r) {
	  for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
	  r.t = this.t;
	  r.s = this.s;
	},
	intValue: function bnIntValue() {
	  if(this.s < 0) {
	    if(this.t == 1) return this[0]-this.DV;
	    else if(this.t == 0) return -1;
	  }
	  else if(this.t == 1) return this[0];
	  else if(this.t == 0) return 0;
	  // assumes 16 < DB < 32
	  return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
	},
	negate: function() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }
};

function am1(i,x,w,j,c,n) {
  while(--n >= 0) {
    var v = x*this[i++]+w[j]+c;
    c = Math.floor(v/0x4000000);
    w[j++] = v&0x3ffffff;
  }
  return c;
}
function am2(i,x,w,j,c,n) {
  var xl = x&0x7fff, xh = x>>15;
  while(--n >= 0) {
    var l = this[i]&0x7fff;
    var h = this[i++]>>15;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
    c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
    w[j++] = l&0x3fffffff;
  }
  return c;
}
function am3(i,x,w,j,c,n) {
  var xl = x&0x3fff, xh = x>>14;
  while(--n >= 0) {
    var l = this[i]&0x3fff;
    var h = this[i++]>>14;
    var m = xh*l+h*xl;
    l = xl*l+((m&0x3fff)<<14)+w[j]+c;
    c = (l>>28)+(m>>14)+xh*h;
    w[j++] = l&0xfffffff;
  }
  return c;
}
function int2char(n) { return BI_RM.charAt(n); }

function intAt(s,i) {
  var c = BI_RC[s.charCodeAt(i)];
  return (c==null)?-1:c;
}
function nbits(x) {
  var r = 1, t;
  if((t=x>>>16) != 0) { x = t; r += 16; }
  if((t=x>>8) != 0) { x = t; r += 8; }
  if((t=x>>4) != 0) { x = t; r += 4; }
  if((t=x>>2) != 0) { x = t; r += 2; }
  if((t=x>>1) != 0) { x = t; r += 1; }
  return r;
}

var dbits;
var canary = 0xdeadbeefcafe;
var j_lm = ((canary&0xffffff)==0xefcafe);

if(global['navigator'] && global['navigator']['appName']){
	if(j_lm && ( global['navigator']['appName'] == "Microsoft Internet Explorer")) {
	  BigInteger.prototype.am = am2;
	  dbits = 30;
	}
	else if(j_lm && (global['navigator']['appName'] != "Netscape")) {
	  BigInteger.prototype.am = am1;
	  dbits = 26;
	}
	else { // Mozilla/Netscape seems to prefer am3
	  BigInteger.prototype.am = am3;
	  dbits = 28;
	}
}else{
	BigInteger.prototype.am = am2;
	dbits = 30;
}


BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1<<dbits)-1);
BigInteger.prototype.DV = (1<<dbits);

var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2,BI_FP);
BigInteger.prototype.F1 = BI_FP-dbits;
BigInteger.prototype.F2 = 2*dbits-BI_FP;

var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr,vv;
rr = "0".charCodeAt(0);
for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
rr = "a".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
rr = "A".charCodeAt(0);
for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;

function nbi() { return new BigInteger(null); }
function nbv(i) { var r = nbi(); r.fromInt(i); return r; }

BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);


function convert(str, inputRadix, outputRadix){
	var pow = Math.log(inputRadix)/Math.log(2);
}
})(typeof module !== 'undefined' && module['exports'] ? module['exports'] : (window['secrets'] = {}), typeof GLOBAL !== 'undefined' ? GLOBAL : window );