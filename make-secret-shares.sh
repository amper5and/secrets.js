#!/usr/bin/env bash

echo "name your secret: ";
read name;

echo "enter secret: ";
read secret;

echo "enter names of shares, separated by spaces: ";
read shares;

sharect=$(echo $shares | tr ' ' '\n' | wc -l);

echo "how many of the $sharect shares ($shares) are required to recover the $name secret?";
read threshold;

#construct a js file that will generate and print the shares

#stub out just enough of the browser environment
#expected by secrets.js to get things working
cat > secret-gen.js <<EOF
module = { "exports" : { "init" : function(){} } };
GLOBAL = { "console" : { "warn" : function(s){ /*print(s);*/ } } };
secrets = {"_processShare":"foo"};
EOF

cat secrets.js >> secret-gen.js;
echo >> secret-gen.js;

cat >> secret-gen.js <<EOF
ps = secrets._processShare
secrets = module['exports']
secrets._processShare = ps

var pw = '$secret';

// convert the secret text into a hex string
var pwHex = secrets.str2hex(pw);

// split into n shares, with given threshold
var shares = secrets.share(pwHex, $sharect, $threshold, 512);

for(var i=0;i<$sharect;i++){
    print(shares[i]);
}

EOF

js secret-gen.js > shares.txt

rm -f ${name}-*-share.html

for i in $(seq 1 $sharect); do
    share=$(head -n $i shares.txt | tail -n 1);
    sharename=$(echo $shares | tr ' ' '\n' | head -n $i | tail -n 1);
    sharefile="${name}-${sharename}-share.html";

    cat > ${sharefile} <<EOF
<html><head><title>Share ${sharename} of ${name}</title>
<script>
EOF
    cat secrets.js >> ${sharefile};
    cat >> ${sharefile} <<EOF

recoverSecret = function (){
    shares = new Array("$share");
    for(var i=0;i<${threshold}-1;i++){
	shares[i+1] = document.getElementById("share-" + (i+2)).value;
    }
    alert(secrets.hex2str(secrets.combine(shares)));
}

</script>
</head>
<body>
<h1><center>Shared Secret &quot;${name}&quot;</center></h1>
<h2>This secret was split into ${sharect} &quot;shares&quot;.  Any ${threshold} of those can be combined to recover the secret.</h2>
<h3>Your share (labeled &quot;${sharename}&quot;) is: <em>${share}</em></h3>
<h3>You can send your share to someone else to help them recover the secret.</h3>
<h3>Or, you can get shares from others and enter them below (in any order) to recover the secret yourself.</h3>
<form action="javascript:recoverSecret()">
EOF

    for i in $(seq 2 ${threshold}); do
	echo "<p><input id=\"share-$i\" type=\"text\" size=\"50\" name=\"share-$i\"/></p>" >> ${sharefile}
    done;

    cat >> ${sharefile} <<EOF
<input type="submit" value="Recover Secret"/>
</form>
</body>
</html>
EOF

done

rm secret-gen.js shares.txt;

echo;
echo "shares generated in the following files:";
ls ${name}-*-share.html;
echo;
echo "so long as $threshold of these files remain together, your secret is exposed!";
