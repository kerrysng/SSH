var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser')
var Stimulsoft = require('stimulsoft-reports-js'); 

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static( path.join(__dirname, 'public')));



app.post('/report', function(req, res) {
                    
        // Loading fonts
        Stimulsoft.Base.StiFontCollection.addOpentypeFontFile("Roboto-Black.ttf"); 

        // Creating new report
        const report = new Stimulsoft.Report.StiReport(); 

        // Loading report template

        report.loadFile( req.body.datapath + req.body.report );         
        console.log('report loaded')

        // Create new DataSet object
        const dataSet = new Stimulsoft.System.Data.DataSet("./public/user");

        // Load JSON data file from specified URL to the DataSet object

//        dataSet.readJson(req.body.json);
        dataSet.readJsonFile("./public/test.json")
        console.log('json file loaded')

        // Remove all connections from the report template
        report.dictionary.databases.clear();
    
        // Register DataSet object
        report.regData("test", "test", dataSet);

        // Render report
        report.render(); 
    
        // Export to PDF
        const pdfData = report.exportDocument(Stimulsoft.Report.StiExportFormat.Pdf);
    
       
        // Converting Array into buffer
        const buffer = new Buffer(pdfData, "utf-8");

    
        // Encoding buffer to contain base64 values
        const string = buffer.toString('base64');
            
        console.log(string)
           
      
        // Saving base64 rendered report into PDF file                 

        fs.writeFileSync( req.body.datapath + req.body.filename , buffer);     

        console.log("Rendered report saved into PDF-file.");
    
        // Rendering UTF-8 report to browser
        
        res.contentType('application/pdf');
        res.send(string)
       
})

   



  

module.exports = app;
    