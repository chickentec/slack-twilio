var path = require('path'),
    express = require('express'),
    bodyParser = require('body-parser'),
    twilio = require('twilio'),
    Slack = require('node-slack'),
    BaseCRM = require('basecrm'),
    deferred = require('deferred');
    
// Load configuration information from system environment variables.
var TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN,
    TWILIO_NUMBER = process.env.TWILIO_NUMBER;

// Create an authenticated client to access the Twilio REST API
var client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    
// Load the Slack configuration
var SLACK_URL = process.env.SLACK_INCOMING_WEBHOOK,
    SLACK_TOKEN = process.env.SLACK_TOKEN,
    SLACK_CHANNEL = process.env.SLACK_CHANNEL;

var slack = new Slack(SLACK_URL);

var BASECRM_TOKEN = process.env.BASECRM_TOKEN;
var baseCRM = new BaseCRM(BASECRM_TOKEN);

// Create an Express app.
var app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'jade');
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// render our home page
app.get('/', function(request, response) {
  response.render('index');
});

app.post('/', function(request, response) {
  // Get the data from the Promise.
  baseCRM.findByPhone(request.body.From.substr(2), 'contacts')(function(value) {
    var res = JSON.parse(value.body);
    var name = res.items.length > 0 ? res.items[0].data.name : '';
    
    slack.send({
        text: request.body.Body,
        channel: SLACK_CHANNEL,
        username: 'Incoming: ' + name + ' ' + request.body.From
    });
  });
  
  // Send an empty reponse back to Twilio
  var twiml = new twilio.TwimlResponse();
  response.writeHead(200, {'Content-Type': 'text/xml'});
  response.end(twiml.toString());
});

app.post('/message', function(request, response) {
  if (request.body.token == SLACK_TOKEN) {
    var phone = request.body.text.substring(0,12);
    if (phone.match(/\+1[0-9]{10}/)) {
      client.sendSms({
        to: phone,
        from: TWILIO_NUMBER,
        body: request.body.text.substring(13)
      }, function(err, data) {
        response.send('Message sent!');
        
        // Get the data from the Promise.
        baseCRM.findByPhone(phone.substr(2), 'contacts')(function(value) {
          var res = JSON.parse(value.body);
          var name = res.items.length > 0 ? res.items[0].data.name : '';
          
          slack.send({
              text: request.body.text.substring(13),
              channel: SLACK_CHANNEL,
              username: 'Outgoing ' + name + " " + phone + ' by ' + request.body.user_name
          });
        });
      });
    }
    else {
      response.send('Invalid phone number format.');
    }
    
  }
  else {
    response.status(500);
  }
});

// Start our express app
var server = app.listen(app.get('port'), function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Listening at http://%s:%s', host, port);
});  