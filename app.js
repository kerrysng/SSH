var express = require('express');
var app = express();
var fs = require('fs');

var base64Data = '';

fs.readFile('./test.txt', 'utf8', (err, data) => {
    if (err) {
        console.log(err);
    }

    fs.writeFile('test.pdf',data, 'base64', function(err) {console.log(err);});
});
   

