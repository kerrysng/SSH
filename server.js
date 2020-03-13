const http = require('http');
const PORT = process.env.PORT || 8000;
const app = require('./app')


const server = http.createServer(app);
server.listen(PORT);
server.on('listening', () => {
  console.log('server started at ' + PORT);
});  //function to run when starting server