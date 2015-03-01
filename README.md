secrets.js
==========

- [What is it?](#what-is-it)
- [Examples](#examples)
- [Installation and usage](#installation-and-usage)
- [API](#api)
- [Share format](#share-format)
- [Note on security](#note-on-security)
- [License](#license)
- [Development and Testing](#development-and-testing)
- [Changelog](#changelog)
- [Possible future enhancements](#possible-future-enhancements)

## What is it?
secrets.js is an implementation of [Shamir's threshold secret sharing scheme](http://en.wikipedia.org/wiki/Shamir's_Secret_Sharing) in JavaScript, for Node.js and browsers with both Global variable and AMD module loading support.

It can be used to split any "secret" (i.e. a password, text file, Bitcoin private key, anything) into _n_ number of "shares" (each the same size in bits as the original secret), requiring that exactly any number _t_ ("threshold") of them be present to reconstruct the original secret.

This is a fork of the original excellent code created by `amper5and` on Github. The [original secrets.js can be found there](https://github.com/amper5and/secrets.js/).

## Examples:

Divide a 512-bit key, expressed in hexadecimal form, into 10 shares, requiring that any 5 of them are necessary to reconstruct the original key:

	// generate a 512-bit key
	var key = secrets.random(512); // => key is a hex string

	// split into 10 shares with a threshold of 5
	var shares = secrets.share(key, 10, 5);
	// => shares = ['801xxx...xxx','802xxx...xxx','803xxx...xxx','804xxx...xxx','805xxx...xxx']

	// combine 4 shares
	var comb = secrets.combine( shares.slice(0,4) );
	console.log(comb === key); // => false

	// combine 5 shares
	comb = secrets.combine( shares.slice(4,9) );
	console.log(comb === key); // => true

	// combine ALL shares
	comb = secrets.combine( shares );
	console.log(comb === key); // => true

	// create another share with id 8
	var newShare = secrets.newShare(8, shares); // => newShare = '808xxx...xxx'

	// reconstruct using 4 original shares and the new share:
	comb = secrets.combine( shares.slice(1,5).concat(newShare) );
	console.log(comb === key); // => true


Divide a password containing a mix of numbers, letters, and other characters, requiring that any 3 shares must be present to reconstruct the original password:

	var pw = '<<PassWord123>>';

	// convert the text into a hex string
	var pwHex = secrets.str2hex(pw); // => hex string

	// split into 5 shares, with a threshold of 3
	var shares = secrets.share(pwHex, 5, 3);

	// combine 2 shares:
	var comb = secrets.combine( shares.slice(1,3) );

	//convert back to UTF string:
	comb = secrets.hex2str(comb);
	console.log( comb === pw  ); // => false

	// combine 3 shares:
	comb = secrets.combine( [ shares[1], shares[3], shares[4] ] );

	//convert back to UTF string:
	comb = secrets.hex2str(comb);
	console.log( comb === pw  ); // => true

There are some additional examples of simple usage in the browser, Node.js, and AMD loading (require.js) in the `examples` folder.

## Installation and usage
This fork of secrets.js is available from [bower.io](http://bower.io/search/?q=secrets.js-grempe) and [www.npmjs.com](https://www.npmjs.com/package/secrets.js-grempe). Install using

	npm install secrets.js-grempe

or

	bower install secrets.js-grempe

The source code for this package is available on [Github](https://github.com/grempe/secrets.js).

To use it in a Node.js application (Requires OpenSSL support compiled into Node):

	var secrets = require('secrets.js');

To use it in the browser with the global 'secrets' defined, include *secrets.js* or *secrets.min.js* in your HTML.

	<script src="secrets.min.js"></script>

You can also use it in the browser with an AMD module loading tool like [require.js](http://www.requirejs.org/). See the AMD loading example in the `examples` dir.

## API

* secrets.share()
* secrets.combine()
* secrets.newShare()
* secrets.init()
* secrets.getConfig()
* secrets.extractShareComponents()
* secrets.setRNG()
* secrets.random()
* secrets.str2hex()
* secrets.hex2str()


#### secrets.share( secret, numShares, threshold, [padLength] )
Divide a `secret` expressed in hexadecimal form into `numShares` number of shares, requiring that `threshold` number of shares be present for reconstructing the `secret`;

* `secret`: String, required: A hexadecimal string.
* `numShares`: Number, required: The number of shares to compute. This must be an integer between 2 and 2^bits-1 (see `secrets.init()` below for explanation of `bits`).
* `threshold`: Number, required: The number of shares required to reconstruct the secret. This must be an integer between 2 and 2^bits-1 (see `secrets.init()` below for explanation of `bits`).
* `padLength`: Number, optional, default `128`: How much to zero-pad the binary representation of `secret`. This ensures a minimum length for each share. See "Note on security" below.

The output of `secrets.share()` is an Array of length `numShares`. Each item in the array is a String. See `Share format` below for information on the format.

#### secrets.combine( shares )
Reconstructs a secret from `shares`.

* `shares`: Array, required: An Array of shares. The form is equivalent to the output from `secrets.share()`.

The output of `secrets.combine()` is a String representing the reconstructed secret. Note that this function will ALWAYS produce an output String. However, if the number of `shares` that are provided is not the `threshold` number of shares, the output _will not_ be the original `secret`. In order to guarantee that the original secret is reconstructed, the correct `threshold` number of shares must be provided.

Note that using _more_ than the `threshold` number of shares will also result in an accurate reconstruction of the secret. However, using more shares adds to computation time.

#### secrets.newShare( id, shares )
Create a new share from the input shares.

* `id`: Number or String, required: A Number representing the share id. The id is an integer between 1 and 2^bits-1. It can be entered as a Number or a number String expressed in hexadecimal form.
* `shares`: Array, required: The array of shares (in the same format as outputted from `secrets.share()`) that can be used to reconstruct the original `secret`.

The output of `secrets.newShare()` is a String. This is the same format for the share that `secrets.share()` outputs. Note that this function ALWAYS produces an output String. However, as for `secrets.combine()`, if the number of `shares` that are entered is not the `threshold` number of shares, the output share _will not_ be a valid share (i.e. _will not_ be useful in reconstructing the original secret). In order to guarantee that the share is valid, the correct `threshold` number of shares must be provided.

#### secrets.init( [bits, rngType] )
Set the number of bits to use for finite field arithmetic.

* `bits`: Number, optional, default `8`: An integer between 3 and 20. The number of bits to use for the Galois field.
* `rngType`: String, optional: A string that has one of the values `["nodeCryptoRandomBytes", "browserCryptoGetRandomValues", "browserSJCLRandom"]`. Setting this will try to override the RNG that would be selected normally based on feature detection. This is probably most useful for testing or for choosing the `browserSJCLRandom` generator which is a good fallback for browsers that don't support crypto.getRandomValues(). Warning: You can specify a RNG that won't actually *work* in your environment.

Internally, secrets.js uses finite field arithmetic in binary Galois Fields of size 2^bits. Multiplication is implemented by the means of log and exponential tables. Before any arithmetic is performed, the log and exp tables are pre-computed. Each table contains 2^bits entries.

`bits` is the limiting factor on `numShares` and `threshold`. The maximum number of shares possible for a particular `bits` is (2^bits)-1 (the zeroth share cannot be used as it is the `secret` by definition.). By default, secrets.js uses 8 bits, for a total 2^8-1 = 255 possible number of shares. To compute more shares, a larger field must be used. To compute the number of bits you will need for your `numShares` or `threshold`, compute the log-base2 of (`numShares`+1) and round up, i.e. in JavaScript: `Math.ceil(Math.log(numShares+1)/Math.LN2)`. You can examine the current calculated `maxShares` value by calling `secrets.getConfig()` and increase the bits accordingly for the number of shares you need to generate.

Note:

* You can call `secrets.init()` anytime to reset *all* internal state and re-initialize.
* `secrets.init()` does NOT need to be called if you plan on using the default of 8 bits. It is automatically called on loading the library.
* The size of the exp and log tables depends on `bits` (each has 2^bits entries). Therefore, using a large number of bits will cause a slightly longer delay to compute the tables.
* The _theoretical_ maximum number of bits is 31, as JavaScript performs bitwise operations on 31-bit numbers. A limit of 20 bits has been hard-coded into secrets.js, which can produce 1,048,575 shares. secrets.js has not been tested with this many shares, and it is not advisable to go this high, as it may be too slow to be of any practical use.
* The Galois Field may be re-initialized to a new setting when `secrets.newShare()` or `secrets.combine()` are called with shares that are from a different Galois Field than the currently initialized one. For this reason, use `secrets.getConfig()` to check what the current `bits` setting is.

#### secrets.getConfig()
Returns an Object with the current configuration. Has the following properties:
* `bits`: [Number] The number of bits used for the current initialized finite field
* `radix`: [Number] The current radix (Default: 16)
* `maxShares`: [Number] The max shares that can be created with the current `bits`. Computed as `Math.pow(2, config.bits) - 1`
* `hasCSPRNG`: [Boolean] Indicates whether or not a Cryptographically Secure Pseudo Random Number Generator has been found and initialized.
* * `typeCSPRNG`: [String] Indicates which random number generator function has been selected based on either environment feature detection (the default) or by manually specifying the RNG type using `secrets.init()` or `secrets.setRNG()`. The current possible types that can be displayed here are ["nodeCryptoRandomBytes", "browserCryptoGetRandomValues", "browserSJCLRandom"].

#### secrets.extractShareComponents( share )
Returns an Object with the extracted parts of a public share string passed as an argument. Has the following properties:
* `bits`: [Number] The number of bits configured when the share was created.
* `id`: [Number] The ID number associated with the share when created.
* `data`: [String] A hex string of the actual share data.

#### secrets.setRNG( function(bits){} | rngType )
Set the pseudo-random number generator used to compute shares.

secrets.js uses a PRNG in the `secrets.share()` and `secrets.random()` functions. By default, it tries to use a cryptographically strong PRNG. In Node.js this is `crypto.randomBytes()`. In browsers that support it, it is `crypto.getRandomValues()` (using typed arrays, which must be supported too). If neither of these are available, and if the `sjcl` library has been loaded it will be used. If it is not loaded an Error will be thrown.

To supply your own PRNG, use `secrets.setRNG()`. It expects a Function of the form `function(bits){}`. It should compute a random integer between 1 and 2^bits-1. The output must be a String of length `bits` containing random 1's and 0's (cannot be ALL 0's). When `secrets.setRNG()` is called, it tries to check the PRNG to make sure it complies with some of these demands, but obviously it's not possible to run through all possible outputs. So make sure that it works correctly.

* `rngType`: String, optional: A string that has one of the values `["nodeCryptoRandomBytes", "browserCryptoGetRandomValues", "browserSJCLRandom"]`. Setting this will try to override the RNG that would be selected normally based on feature detection. This is probably most useful for testing or for choosing the `browserSJCLRandom` generator which is a good fallback for browsers that don't support crypto.getRandomValues(). Warning: You can specify a RNG that won't actually *work* in your environment.

#### secrets.random( bits )
Generate a random `bits` length string, and output it in hexadecimal format. `bits` must be an integer greater than 1.

#### secrets.str2hex( str, [bytesPerChar] )
Convert a UTF string `str` into a hexadecimal string, using `bytesPerChar` bytes (octets) for each character.

* `str`: String, required: A UTF string.
* `bytesPerChar`: Number, optional, default `2`. The maximum `bytesPerChar` is 6 to ensure that each character is represented by a number that is below JavaScript's 2^53 maximum for integers.

#### secrets.hex2str( str, [bytesPerChar] )
Convert a hexadecimal string into a UTF string. Each character of the output string is represented by `bytesPerChar` bytes in the String `str`. See note on `bytesPerChar` under `secrets.str2hex()` above.

## Share Format
Each share is a string in the format `<bits><id><value>`. Each part of the string is described below:

* `bits`: The first character, expressed in Base36 format, is the number of bits used for the Galois Field. This number must be between 3 and 20, expressed by the characters [3-9, a-k] in Base36.
* `id`: The id of the share. This is a number between 1 and 2^bits-1, expressed in hexadecimal form. The number of characters used to represent the id is the character-length of the representation of the maximum id (2^bits-1) in hexadecimal: `(Math.pow(2,bits)-1).toString(16).length`.
* `data`: The value of the share, expressed in hexadecimal form. The length of this string depends on the length of the secret.

You can extract these attributes from a share in your possession with the `secrets.extractShareComponents(share)` function which will return an Object with these attributes. You may use these values, for example, to call `secrets.init()` with the proper bits setting for shares you want to combine.

## Note on Security
Shamir's secret sharing scheme is "information-theoretically secure" and "perfectly secure" in that less than the requisite number of shares provide no information about the secret (i.e. knowing less than the requisite number of shares is the same as knowing none of the shares). However, because the size of each share is the same as the size of the secret (when using binary Galois fields, as secrets.js does), in practice it does leak _some_ information, namely the _size_ of the secret. Therefore, if you will be using secrets.js to share _short_ password strings (which can be brute-forced much more easily than longer ones), it would be wise to zero-pad them so that the shares do not leak information about the size of the secret. With this in mind, secrets.js will zero-pad in multiples of 128 bits by default which slightly increases the share size for small secrets in the name of added security. You can increase or decrease this padding manually by passing the `padLength` argument to `secrets.share()`.

When `secrets.share()` is called with a `padLength`, the `secret` is zero-padded so that it's length is a multiple of the padLength. The second example above can be modified to use 1024-bit zero-padding, producing longer shares:

	var pw = '<<PassWord123>>';

	// convert the text into a hex string
	var pwHex = secrets.str2hex(pw); // => 240-bit password

	// split into 5 shares, with a threshold of 3, WITH zero-padding
	var shares = secrets.share(pwHex, 5, 3, 1024); // => 1024-bit padded shares

	// combine 3 shares
	var comb = secrets.combine( [ shares[1], shares[3], shares[4] ] );

	// convert back to UTF string
	comb = secrets.hex2str(comb);

	console.log( comb === pw  ); // => true


## License
secrets.js is released under the MIT License. See the `LICENSE` file.

## Development and Testing

Install [Node.js](http://nodejs.org/) first using an [Installer](http://nodejs.org/download/) or a [package manager for your OS](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager).

Install all development dependencies locally:

	// GLOBAL
	npm install -g bower
	npm install -g grunt-cli
	npm install -g uglify-js
	npm install -g jasmine-node@2.0.0

	// LOCAL
	cd secrets.js/
	npm install
	bower install

### Continuous Development

You can run 'grunt watch' to start watching all JavaScript files and run the testing and minification Grunt tasks on every save to a file.

### Minifying

The minified version of the `secrets.js` can be found in `secrets.min.js`. This file was generated using the [UglifyJS2](https://github.com/mishoo/UglifyJS2) tool and was run with `grunt`:

	grunt uglify

### Browser Testing with Jasmine

There is a [Jasmine](https://jasmine.github.io/) test suite that exercises the entire `secrets` module that can be run
by simply opening the `SpecRunner.html` file in your browser. You can run the specs against the minified version of secrets.js by opening `SpecRunnerMinified.html`.

	(On OS X)
	open SpecRunner.html
	open SpecRunnerMinified.html

### Node.js Testing with Jasmine

You can also run the Jasmine test suite within a Node.js instance (assumes proper install of jasmine-node as shown above).

	grunt jasmine_nodejs

OR

	jasmine-node spec/

## Changelog

* 1.1.0
	* Added `grunt watch` task to auto-run tests and minification on every JavaScript file save.
	* Minified file now contains name, version and author comments automatically.
	* Configured basic `grunt` tasks for minification, Node.js testing with Jasmine, jshint, eslint. Removed Karma test runner and manual minification and testing steps. Just run `grunt`.
	* [Bugfix] calling `secrets.init()` now actually resets *all* internal state back to the default settings. Previously `init()` only reset some internal values. `init()` now calls a new private function `reset()` to accomplish this.
	* [Enhancement] If the [Stanford Javascript Crypto Libarary (SJCL)](https://bitwiseshiftleft.github.io/sjcl/) is loaded in the browser it can be used as a fallback, or explicitly selected, CSPRNG for those browsers that don't support `crypto.getRandomValues()`. It uses the Fortuna RNG and collects additional entropy from mouse movements continually. The downside is that it requires mouse movements initially before `secrets.random()` can be called.  `secrets.random()` will throw an Error if called when SJCL is not fully seeded. Currently set to use the maximum SJCL 'paranoia' level of 10. An enhancement to this might be to call out to retrieve one or more external sources of entropy (and mixing them together) to pre-seed the RNG when the library is loaded.
	* [Enhancement] You can now pass a string to `init()` or `setRNG()` which forces loading of a specific RNG (whether it will work or not in your current env!)
	* Re-factored how `getRNG()` works internally. Now it returns small focused functions, not a giant function with detection conditionals. If SJCL is loaded the RNG tests are skipped since they would always initially fail due to the entropy pool being initally empty. This should be OK for this 'trusted' RNG.


* 1.0.0
	* Packaging cleanup and ready for 1.0.0 release on Bower and NPM.
	* [Enhancement] Now supports the Javascript Universal Module Definition [UMDJS](https://github.com/umdjs/umd) for loading this module in the Browser with a `secrets` global, using an AMD Module loader like require.js, or in Node.js apps.
	* Refactor getRNG() to no longer have embedded `require` now that crypto is included on module load with the UMDJS change.
	* Updated README.md with info about this fork of secrets.js.
	* Added some simple examples of usage to the examples folder.

* 0.2.0
	* [Enhancement] Extend the output of getConfig() to include the `radix` and `maxShares` properties.
	* [Security] Zero-pad all secrets in multiples of 128 bits (instead of 0) by default.
	* [Performance] Massive (100x) speed optimization to padLeft() private function (the second most frequently called block of code internally).
	* [Testing] Added a full jasmine test suite and Karma test runner. Karma runs will also generate code coverage HTML reports. Code coverage is currently >90%.
	* [Testing] Expose all private functions as Underscore (_) prefixed functions to allow direct unit testing.
	* [Security] Removed Math.random fallback random number generator. Should always fail safe, even if it means not working. `secrets.getConfig().unsafePRNG` will always result in undefined now as it is no longer ever set.
	* Refactored away need to know anything about `global` var.
	* [Testing] jslint.com, jshint.com, and eslint CLI warnings for code and style now clean.
	* Beautify code.
* 0.1.8: bugfix release
* 0.1.7: added config.unsafePRNG reset when supplying a new PRNG
* 0.1.6:
	* Removed JSBN dependency, support for arbitrary radices, and the `convertBase()` function, with attendant 50% file size reduction.
	* Fixed bug where leading zeros were dropped.
	* Renamed string conversion functions.
* 0.1.5: getConfig() returns information about PRNG
* 0.1.4: new share format


## Possible future enhancements
* Consider changing the share format to output Base 58 strings which are more human friendly. (Requires share format change)
* Consider removing the ID from each share (or make it optional) since it leaks information about how many shares are in the wild. (Requires share format change)
* Add a checksum to the share format to validate its integrity and reject combine() of bad shares. (Requires share format change)
* Operate on [node.js streams](http://nodejs.org/api/stream.html)
* [Cheater-detection](http://h.web.umkc.edu/harnl/papers/J68.pdf)
* [Dynamic threshold](http://www1.spms.ntu.edu.sg/~ctartary/Dynamic_Threshold_INSCRYPT2006.pdf)
* Investigate speed enhancements in polynomial evaluation and polynomial interpolation
