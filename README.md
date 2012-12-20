secrets.js
==========

## What is it?
secrets.js is an implementation of [Shamir's threshold secret sharing scheme](http://en.wikipedia.org/wiki/Shamir's_Secret_Sharing) in javascript, for node.js and browsers. 

It can be used to split any "secret" (i.e. a password, text file, Bitcoin private key, anything) into _n_ number of "shares" (each the same size in bits as the original secret), requiring that exactly any number _t_ ("threshold") of them be present to reconstruct the original secret.


## Examples: 

Divide a 512-bit key, expressed in hexadecimal form, into 10 shares, requiring that any 5 of them are necessary to reconstruct the original key:
	
	// generate a 512-bit key
	var key = secrets.random(512); // => key is a hex string
	
	// split into 10 shares with a threshold of 5
	var shares = secrets.share(key, 10, 5); 
	// => shares = ['1-xxx...xxx','2-xxx...xxx','3-xxx...xxx','4-xxx...xxx','5-xxx...xxx']
	
	// combine 4 shares
	var comb = secrets.combine( shares.slice(0,4) );
	console.log(comb === key); // => false
	
	// combine 5 shares
	var comb = secrets.combine( shares.slice(4,9) );
	console.log(comb === key); // => true
	
	// combine ALL shares
	var comb = secrets.combine( shares );
	console.log(comb === key); // => true
	
	// create another share with id 8
	var newShare = secrets.newShare(8, shares); // => newShare = '8-xxx...xxx'
	
	// reconstruct using 4 original shares and the new share:
	var comb = secrets.combine( shares.slice(1,5).concat(newShare) );
	console.log(comb === key); // => true


Divide a password containing a mix of numbers, letters, and other characters, requiring that any 3 shares must be present to reconstruct the original password:

	var pw = '<<PassWord123>>';
	
	// convert the text into a hex string
	var pwHex = secrets.toHex(pw); // => hex string
	
	// split into 5 shares, with a threshold of 3
	var shares = secrets.share(pwHex, 5, 3);
	
	
	// combine 2 shares:
	var comb = secrets.combine( shares.slice(1,3) );
	
	//convert back to UTF string:
	comb = secrets.toString(comb);
	console.log( comb === pw  ); // => false
	
	
	// combine 3 shares:
	var comb = secrets.combine( [ shares[1], shares[3], shares[4] ] );
	
	//convert back to UTF string:
	comb = secrets.toString(comb);
	
	console.log( comb === pw  ); // => true

## Installation and usage
secrets.js is available on [npm](https://npmjs.org/package/secrets.js). Install using

	npm install secrets.js

The version on npm may not always reflect all the latest changes, especially during times of heavy development. To get the most up-to-date version, download [the current master zip file](https://github.com/amper5and/secrets.js/zipball/master), then run the following code from inside the folder:

	npm install

		
To use it in node.js:
	
	var secrets = require('secrets.js');

To use it in the browser, include *secrets.js* or *secrets.min.js* (minified using Google Closure Compiler)

	<script src="secrets.min.js"></script>

	
## API

* secrets.share()
* secrets.combine()
* secrets.newShare()
* secrets.init()
* secrets.getConfig()
* secrets.setRNG()
* secrets.random()
* secrets.toHex()
* secrets.toString()
* secrets.convertBase()


#### secrets.share( secret, numShares, threshold, [inputRadix, outputRadix, padLength] )
Divide a `secret` expressed in `inputRadix` into `numShares` number of shares, each expressed in `outputRadix`, requiring that `threshold` number of shares be present for reconstructing the `secret`;

* `secret`: String, required: A number string. By default it is assumed to be in hexadecimal format. The radix can be overridden with `inputRadix` (see below).
* `numShares`: Number, required: The number of shares to compute. This must be an integer between 2 and 2^bits-1 (see `secrets.init()` below for explanation of `bits`).
* `threshold`: Number, required: The number of shares required to reconstruct the secret. This must be an integer between 2 and 2^bits-1 (see `secrets.init()` below for explanation of `bits`).
* `inputRadix`: Number, optional, default `16`: The radix of the `secret`. Must be an integer between 2 and 36. For example, enter `2` for binary strings, `16` for hex strings, and `36` for alpha-numeric strings (Note: `36` uses the numbers 0-9 and letters a-z, NOT differentiating between upper and lower case.)
* `outputRadix`: Number, optional, default `16`: The radix of the output shares. Must be an integer between 2 and 36.
* `padLength`: Number, optional, default `0`: How much to zero-pad the binary representation of `secret`. This ensures a minimum length for each share. See "Note on security" below.

The output of `secrets.share()` is an Array of length `numShares`. Each item in the array is a share of the secret. Each share is a String in the form `id-share`, where `id` is an integer between 1 and 2^bits-1, expressed in base `outputRadix`, and `string` is the actual share, also expressed in base `outputRadix`.

#### secrets.combine( shares, [inputRadix, outputRadix] )
Reconstructs a secret from `shares`.

* `shares`: Array, required: An Array of shares. The form is equivalent to the output from `secrets.share()`.
* `inputRadix`: Number, optional, default `16`: The radix of the shares. See `outputRadix` in `secrets.share()` above.
* `outputRadix`: Number, optional, default `16`: The radix of the output reconstructed secret.

The output of `secrets.combine()` is a String representing the reconstructed secret. Note that this function will ALWAYS produce an output String. However, if the number of `shares` that are provided is not the `threshold` number of shares, the output _will not_ be the original `secret`. In order to guarantee that the original secret is reconstructed, the correct `threshold` number of shares must be provided.

Note that using _more_ than the `threshold` number of shares will also result in an accurate reconstruction of the secret. However, using more shares adds to computation time.

#### secrets.newShare( id, shares, [radix] )
Create a new share from the input shares.

* `id`: Number or String, required: A Number representing the share id. The id is an integer between 1 and 2^bits-1. It can be entered as a Number or a number String expressed in the same base `radix` as the `shares`, i.e. using 10 and "a" (base 16) for `id` will both output the 10th share.
* `shares`: Array, required: The array of shares (in the same format as outputted from `secrets.share()`) that can be used to reconstruct the original `secret`. 
* `radix`: Number, optional: The radix of the `shares` and of the `id`, if the `id` is a String.

The output of `secrets.newShare()` is a String of the form 'id-string'. This is the same format for the share that `secrets.share()` outputs. Note that this function ALWAYS produces an output String. However, as for `secrets.combine()`, if the number of `shares` that are entered is not the `threshold` number of shares, the output share _will not_ be a valid share (i.e. _will not_ be useful in reconstructing the original secret). In order to guarantee that the share is valid, the correct `threshold` number of shares must be provided.

#### secrets.init( [bits] )
Set the number of bits to use for finite field arithmetic and the default radix to use for inputs and outputs.

* `bits`: Number, optional, default `8`: An integer between 3 and 20. The number of bits to use for the Galois field.

Internally, secrets.js uses finite field arithmetic in binary Galois Fields of size 2^bits. Multiplication is implemented by the means of log and exponential tables. Before any arithmetic is performed, the log and exp tables are pre-computed. Each table contains 2^bits entries. 

`bits` is the limiting factor on `numShares` and `threshold`. The maximum number of shares possible for a particular `bits` is (2^bits)-1 (the zeroth share cannot be used as it is the `secret` by definition.). By default, secrets.js uses 8 bits, for a total 2^8-1 = 255 possible number of shares. To compute more shares, a larger field must be used. To compute the number of bits you will need for your `numShares` or `threshold`, compute the log-base2 of (`numShares`+1) and round up, i.e. in javascript: `Math.ceil(Math.log(numShares+1)/Math.log(2))`. 

Note:

* `secrets.init()` does NOT need to be called if you plan on using the default of 8 bits. It is automatically called on loading the library.
* The size of the exp and log tables depends on `bits` (each has 2^bits entries). Therefore, using a large number of bits will cause a slightly longer delay to compute the tables.
* In order to properly reconstruct a secret, the _same_ field size used to compute the shares must be used. If you use a 10-bit field to compute the shares, and an 8-bit field to reconstruct the secret, the secret _will be incorrect_. Because of this, I am considering adding the bit-size to each share, i.e. so each share has the form "bits-id-string". Depending on feedback, a future update may include this format for the shares.
* The _theoretical_ maximum number of bits is 31, as javascript performs bitwise operations on 31-bit numbers. A limit of 20 bits has been hard-coded into secrets.js, which can produce 1,048,575 shares. secrets.js has not been tested with this many shares, and it is not advisable to go this high, as it may be too slow to be of any practical use.

#### secrets.getConfig()
Returns the number of `bits` used for the current initialized finite field.

#### secrets.setRNG( function(bits){} )
Set the pseudo-random number generator used to compute shares.

secrets.js uses a PRNG in the `secrets.share()` and `secrets.random()` functions. By default, it tries to use a cryptographically strong PRNG. In node.js this is `crypto.randomBytes()`. In browsers that support it, it is `crypto.getRandomValues()` (using typed arrays, which must be supported too). If neither of these are available it defaults to using `Math.random()`, which is NOT cryptographically strong (except reportedly in Safari, though I have yet to confirm this). A warning will be displayed in the console and in an alert box in browsers when `Math.random()` is being used.

To supply your own PRNG, use `secrets.setRNG()`. It expects a Function of the form `function(bits){}`. It should compute a random integer between 1 and 2^bits-1. The output must be a String of length `bits` containing random 1's and 0's (cannot be ALL 0's). When `secrets.setRNG()` is called, it tries to check the PRNG to make sure it complies with some of these demands, but obviously it's not possible to run through all possible outputs. So make sure that it works correctly.

If you are just planning on using `secrets.combine()` or `secrets.newShare()`, then no PRNG is required. It is only used by the `secrets.share()` and `secrets.random()` functions.

NOTE: In a near-future version of secrets.js, the requirement for the PRNG function will be less convoluted. It probably will just have to return a random integer between 1 and `max`, or something like that.

#### secrets.random( bits )
Compute a random `bits`-length string, and output it in hexadecimal format. `bits` must be an integer greater than 1. 

#### secrets.toHex( str, [bytesPerChar] )
Convert a UTF string `str` into a hexadecimal string, using `bytesPerChar` bytes (octets) for each character. 

* `str`: String, required: A UTF string. 
* `bytesPerChar`: Number, optional, default `2`. The maximum `bytesPerChar` is 6 to ensure that each character is represented by a number that is below javascript's 2^53 maximum for integers.

#### secrets.toString( str, [bytesPerChar] )
Convert a hexadecimal string into a UTF string. Each character of the output string is represented by `bytesPerChar` bytes in the String `str`. See note on `bytesPerChar` under `secrets.toHex()` above.

#### secrets.convertBase( str, inputRadix, outputRadix )
Convert a number string `str` in base `inputRadix` into a number string in base `outputRadix`


## Note on security
Shamir's secret sharing scheme is "information-theoretically secure" and "perfectly secure" in that less than the requisite number of shares provide no information about the secret (i.e. knowing less than the requisite number of shares is the same as knowing none of the shares). However, because the size of each share is the same as the size of the secret (when using binary Galois fields, as secrets.js does), in practice it does leak _some_ information, namely the _size_ of the secret. Therefore, if you will be using secrets.js to share _short_ password strings (which can be brute-forced much more easily than longer ones), it would be wise to zero-pad them so that the shares do not leak information about the size of the secret.

When `secrets.share()` is called with a `padLength`, the `secret` is zero-padded so that it's length is a multiple of the padLength. The second example above can be modified to use 1024-bit zero-padding, producing longer shares:
	
	var pw = '<<PassWord123>>';
	
	// convert the text into a hex string
	var pwHex = secrets.toHex(pw); // => 230-bit password

	// split into 5 shares, with a threshold of 3, WITH zero-padding
	var shares = secrets.share(pwHex, 5, 3, null, null, 1024); // => 1024-bit shares
	
	// Print the bit-length of the first share.
	// It will be close to 1024, because any leading 0-valued bits are dropped.
	console.log( 'First share bit-length:', secrets.convertBase(shares[0].split('-')[1], 16, 2).length );
	
	// combine 3 shares
	var comb = secrets.combine( [ shares[1], shares[3], shares[4] ] );
	
	// convert back to UTF string
	comb = secrets.toString(comb);
	
	console.log( comb === pw  ); // => true

	
## Note on sharing binary strings
Currently, any leading zero's of the secret are dropped. This is because secrets.js uses jsbn to convert the inputs. Normally, this is not a huge deal, but can be important in some applications. I am looking for an efficient base-conversion library that will retain these zeros. Suggestions on this point are welcome.


## Dependencies
There are no external dependencies. secrets.js is bundled with a modified sub-set of Tom Wu's BSD-licensed Javascript BigInteger library [jsbn](http://www-cs-students.stanford.edu/~tjw/jsbn/). This is only used for number string conversion, not arithmetic. See `jsbnLICENSE` for the license.


## License
secrets.js is released under the MIT License. See `LICENSE`.


## Possible future enhancements
* A full-featured online demo
* A strong PRNG for browsers that don't have crypto.getRandomValues()
* Use just XOR operations for (n,n) sharing
* Operate on [node.js streams](http://nodejs.org/api/stream.html)
* Compatibility with other secret sharing programs, such as [ssss-split](http://point-at-infinity.org/ssss/) and [SecretSplitter](https://github.com/moserware/SecretSplitter)
* [Cheater-detection](http://h.web.umkc.edu/harnl/papers/J68.pdf)
* [Dynamic threshold](http://itcs.tsinghua.edu.cn/~ctartary/Dynamic_Threshold_INSCRYPT2006.pdf)
* Possible speed enhancements in polynomial evaluation and polynomial interpolation
* Investigate other sharing schemes that might be faster