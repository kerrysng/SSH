var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var aws = require('aws-sdk');
var fs = require('fs');
var execSync = require('child_process').execSync;
var port = process.env.PORT || 32806;
var s3 = new aws.S3();
var parser = require('xml2json')

process.env.DISABLE_V8_COMPILE_CACHE = 1;

app.use(bodyParser.json());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


app.post('/', function (req, res) {
    console.log(req.body.ApiKey);
    console.log(req.body.Signatures);

    const TenantGUID = req.body.TenGUID
    const DocumentGUID = req.body.DocGUID;
    const data = req.body.Data;
    const signatures = req.body.Signatures;
    const TenantDir = "/tmp/" + TenantGUID;
    const S3Source = "s3://" + req.body.Document;
    const DocFile = S3Source.substring(S3Source.lastIndexOf("/") + 1, S3Source.lastIndexOf("."));
    const WorkingDirName = Math.random().toString().replace('0.', '');
    const DocDir = "/tmp/" + WorkingDirName;
    const ContentXML = DocDir + "/" + DocFile + "/word/document.xml";
    const ContentXMLsig = DocDir + "/" + DocFile + "/word/_rels/document.xml.rels";

    //Shell Commands for downloading form pack from S3
    const DownloadExtract = "mkdir --parents " + DocDir + " && aws s3 cp " + S3Source + " " + DocDir + "/" + DocFile + ".zip && cd " + DocDir + " && unzip -o " + DocFile + ".zip -d ./" + DocFile; //"mkdir --parents " + DocDir + " && aws s3 cp " + S3Source + " " + DocDir +
    ".zip && cd " + TenantDir + " && unzip -o " + DocumentGUID + ".zip -d ./" + DocumentGUID;

    const ZipConvertUpload = "cd " + DocDir + "/" + DocFile + " && zip -r " + DocFile + ".docx ./ && libreoffice6.4 --headless --convert-to pdf " + DocFile + ".docx";

    const DelTempFiles = "rm -r " + DocDir;


    try {
        let reqKey = req.body.ApiKey
        console.log(reqKey)
    } catch (err) {
        if (reqKey != "027823aaiv0fvy0s987dfv34nhpgfi7v74871669390") {
            res.status(700).send({
                error: err.message
            });
        } else {
            console.log('valid')
        }
    };

    try {
        console.log(DownloadExtract);
        execSync(DownloadExtract);
    } catch (err) {
        res.status(500).send({
            error: err.message
        });
    };

    //Read the content.xml file to be processed by find and replace.
    try {
        var content = fs.readFileSync(ContentXML, "utf8");

    } catch (err) {

        res.status(600).send({
            error: err.message
        });
    }
    //Find and replace all form-tag values listed in JSON object
    try {
        var keys = Object.keys(data);
        var values = Object.values(data);
        for (var i = 0, len = keys.length; i < len; i++) {
            var regexgen = new RegExp(keys[i], "g");
            var content = content.replace(regexgen, values[i]);
            console.log('doc keyssss: ', keys[i]);
            console.log('doc valuesss: ', values[i]);
        };

        console.log("signatures: ", signatures);
        if (typeof signatures !== 'undefined') {
            var sigkeys = Object.keys(signatures);
            var sigvalues = Object.values(signatures);

            for (var e = 0, len = sigkeys.length; e < len; e++) {

                console.log('TESTING-SIGKEYS ' + sigkeys[e]);
                console.log('TESTING-SIGVALUES ' + sigvalues[e]);

                //DECLARE REFERENCE PATH (FIND) + UPDATE SOURCE HERE

                var sigkeyname = sigkeys[e].substring(sigkeys[e].indexOf("/signatures/") + 12, sigkeys[e].length);

                // COPY SIGNATURES to s3 and to local file path
                var cplocalsigs = "aws s3 cp s3://" + sigvalues[e] + " " + DocDir + "/localsigs/" + sigkeyname;
                execSync(cplocalsigs);

                // FIND & REPLACE S3 bucket SIG REFERENCE to local tmp folder

                const newsigPath = DocDir + "/localsigs/" + sigkeyname
                const appsigPath = "file://" + DocDir + "/localsigs/" + "/extparty/AppBlank1.jpg/"
               
                const data = fs.readFileSync(ContentXMLsig, "utf8");
                 //XML parser module
                //allows json to be converted back to XML(reversible: true)
                let json = JSON.parse(parser.toJson(data, {
                    reversible: true
                }));
                //XML signature doc contains <relationship> tags to external resources
                var values = json["Relationships"]["Relationship"]
                //loop to find ext reference to S3 bucket and replace with local file path
                for (var i = 0; i < values.length; i++) {
                    const value = values[i]

                    if (value.Target == "file:///C:\\signatures\\extparty\\ExtBlank1.jpg") {
                        value.Target = newsigPath

                    } else if(value.Target == "file:///C:\\signatures\\extparty\\AppBlank1.jpg") {
                        value.Target = appsigPath
                    }
                    console.log('new values: ', value)
                };
                //convert json to xml
                const stringified = JSON.stringify(json)
                const xml = parser.toXml(stringified);
                fs.writeFile(ContentXMLsig, xml, function (err, data) {
                    if (err) {
                        console.log(err)
                    } else {
                        console.log('final values: ', xml)
                    }
                })


            };
        } else {
            console.log("No Signatures");
        };
        fs.writeFileSync(ContentXML, content, "utf8")

    } catch (err) {
        res.status(602).send({
            error: err.message
        });
    }

    //Run the final shell command
    try {
        console.log(ZipConvertUpload);

        function delayZip() {
            execSync(ZipConvertUpload)
        }
        setTimeout(delayZip, 2000)

    } catch (err) {
        res.status(603).send({
            error: err.message
        });
    }

    //Set PDF path to variable
    var PDFPath = DocDir + "/" + DocFile + "/" + DocFile + ".pdf";
    console.log(PDFPath);
    //Read PDF file into memory
    try {
        var PDF = fs.readFileSync(PDFPath);
    } catch (err) {
        res.status(604).send({
            error: err.message
        });
    }

    //Convert PDF buffer into base64 and return as JSON object
    var PDF64 = PDF.toString('base64');
    var PDFres = '{"PDFDocument":"' + PDF64 + '"}'
    //Delete Temp Files
    try {
        //#execSync(DelTempFiles);
    } catch (err) {
        res.status(605).send({
            error: err.message
        });
    }

    //Return Response
    try {
        res.status(200).send(PDFres); //console.log(PDFres);//res.sendStatus(PDFres);
    } catch (err) {
        res.status(606).send({
            error: err.message
        });
    }

});


app.listen(port, function () {
    console.log('Port: ' + port);
});
