var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var aws = require('aws-sdk');
var fs = require('fs');
var execSync = require('child_process').execSync;
var port = process.env.PORT || 32806;
var s3 = new aws.S3();

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
    if (req.body.ApiKey == "027823aaiv0fvy0s987dfv34nhpgfi7v74871669390") {
        //Variables passed in
        var TenantGUID = req.body.TenGUID;
        var DocumentGUID = req.body.DocGUID;
        //var MailMerge = JSON.parse(req.body.MailMerge);
        var data = req.body.Data;
        var signatures = req.body.Signatures;
        //Variables
        //var ContentXML = "/tmp/" + TenantGUID + "/" + DocumentGUID + "/" + "content.xml";
        var TenantDir = "/tmp/" + TenantGUID;

        var S3Source = "s3://" + req.body.Document;
        var DocFile = S3Source.substring(S3Source.lastIndexOf("/") + 1, S3Source.lastIndexOf(".")); //"/tmp/" + TenantGUID + "/" + DocumentGUID + "/" + DocumentGUID;
        //var DocFile = DocFile.substring(0, DocFile.lastIndexOf("."));
        var WorkingDirName = Math.random().toString().replace('0.', '');
        var DocDir = "/tmp/" + WorkingDirName; //"/tmp/" + TenantGUID + "/" + DocumentGUID;

        var ContentXML = DocDir + "/" + DocFile + "/word/document.xml";
        var ContentXMLsig = DocDir + "/" + DocFile + "/word/_rels/document.xml.rels";
        var DownloadExtract = "mkdir --parents " + DocDir + " && aws s3 cp " + S3Source + " " + DocDir + "/" + DocFile + ".zip && cd " + DocDir + " && unzip -o " + DocFile + ".zip -d ./" + DocFile; //"mkdir --parents " + DocDir + " && aws s3 cp " + S3Source + " " + DocDir +
        ".zip && cd " + TenantDir + " && unzip -o " + DocumentGUID + ".zip -d ./" + DocumentGUID;
        var ZipConvertUpload = "cd " + DocDir + "/" + DocFile + " && zip -r " + DocFile + ".docx ./ && libreoffice6.4 --headless --convert-to pdf " + DocFile + ".docx";

        var DelTempFiles = "rm -r " + DocDir;

        //Run the shell command to download and extract the odt file

        try {
            console.log(DownloadExtract);
            execSync(DownloadExtract);
        } catch (err) {
            //throw new SyntaxError("Error 600: S3 download and extract failed.");
            res.status(500).send("{\"Error\": \"600\", \"Reason\": \"The API was unable to download the document from S3 and extract it locally.\"}");
        }


        //Read the content.xml file to be processed by find and replace.
        try {
            var content = fs.readFileSync(ContentXML, "utf8");
            var contentsig = fs.readFileSync(ContentXMLsig, "utf8");
        } catch (err) {
            //throw new SyntaxError("Error 600: S3 download and extract failed.");
            res.send("{\"Error\": \"601\", \"Reason\": \"The API was unable to read the extracted file.\"}");
        }
        //Find and replace all values listed in JSON object
        try {
            var keys = Object.keys(data);
            var values = Object.values(data);
            for (var i = 0, len = keys.length; i < len; i++) {
                var regexgen = new RegExp(keys[i], "g");
                var content = content.replace(regexgen, values[i]);
                console.log(keys[i]);
                console.log(values[i]);
            };
            console.log("signatures: ", signatures);
            if (typeof signatures !== 'undefined') {
                var sigkeys = Object.keys(signatures);
                var sigvalues = Object.values(signatures);

                for (var e = 0, len = sigkeys.length; e < len; e++) {
                    ////var OverwriteBlankSig = "rm " + DocDir + "/" + DocFile + "/word/media/" + sigkeys + " && aws s3 cp s3://" + sigvalues[e] + " " + DocDir + "/" + DocFile + "/word/media/" + sigkeys;
                    console.log('TESTING-SIGKEYS ' + sigkeys[e]);
                    console.log('TESTING-SIGVALUES ' + sigvalues[e]);

                    //DECLARE REFERENCE PATH (FIND) + UPDATE SOURCE HERE
                    //var sigkeyname = sigkeys[e].substring(sigkeys[e].lastIndexOf("/", sigkeys[e].lastIndexOf("/")), sigkeys[e].length);
                    var sigkeyname = sigkeys[e].substring(sigkeys[e].indexOf("/signatures/") + 12, sigkeys[e].length);

                    var newkeyaddr = "https://beta-digital-forms-public.s3-ap-southeast-2.amazonaws.com/signatures/" + sigkeyname;
                    console.log('TESTING-SIGKEY-COMPOSITION ' + newkeyaddr);
                    // COPY SIGNATURES LOCALLY
                    var cplocalsigs = "aws s3 cp s3://" + sigkeys[e] + " " + DocDir + "/localsigs/" + sigkeyname;
                    execSync(cplocalsigs);



                    // FIND & REPLACE LOCAL SIG REFERENCE


                    var regexgensig = new RegExp(newkeyaddr, "g");
                    var contentsig = contentsig.replace(regexgensig, DocDir + "/localsigs/" + sigkeyname);
                };
            } else {
                console.log("No Signatures");
            };

        } catch (err) {
            res.send("{\"Error\": \"602\", \"Reason\": \"The API failed to complete the find and replace operation.\"}");
            console.log(err);
        }
        //Write for loop changes to disk
        try {
            fs.writeFileSync(ContentXML, content, "utf8");
            fs.writeFileSync(ContentXMLsig, contentsig, "utf8");
        } catch (err) {
            res.send("{\"Error\": \"603\", \"Reason\": \"The API failed to write the find and replace values to disk.\"}");
        }
        //Run the final shell command
        try {
            console.log(ZipConvertUpload);
            execSync(ZipConvertUpload);
        } catch (err) {
            res.send("{\"Error\": \"603\", \"Reason\": \"The API failed to write the find and replace values to disk.\"}");
        }

        //Set PDF path to variable
        var PDFPath = DocDir + "/" + DocFile + "/" + DocFile + ".pdf";
        console.log(PDFPath);
        //Read PDF file into memory
        try {
            var PDF = fs.readFileSync(PDFPath);
        } catch (err) {
            res.send("{\"Error\": \"604\", \"Reason\": \"The API failed to read the PDF from disk.\"}");
        }

        //Convert PDF buffer into base64 and return as JSON object
        var PDF64 = PDF.toString('base64');
        var PDFres = '{"PDFDocument":"' + PDF64 + '"}'
        //Delete Temp Files
        try {
            //#execSync(DelTempFiles);
        } catch (err) {
            res.send("{\"Error\": \"605\", \"Reason\": \"The API failed to delete the temporary working directory.\"}");
        }

        //Return Response
        try {
            res.status(200).send(PDFres); //console.log(PDFres);//res.sendStatus(PDFres);
        } catch (err) {
            res.send("{\"Error\": \"606\", \"Reason\": \"The API failed to generate a valid response value.\"}");
        }
    } else {
        res.status(403).send("{\"Error\": \"700\", \"Reason\": \"Invalid Auth\"}")
    }
});
app.listen(port, function () {
    console.log('Port: ' + port);
});
