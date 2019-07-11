#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>

// GitHub Page = https://github.com/Tommrodrigues/homebridge-web-sprinkers

// Script Type = Sprinkler controller

/* Zone pins:
1 - D0
2 - D1
3 - D2
4 - D3
5 - D4
6 - D5
7 - D6
8 - D7
9 - D8
*/

/////////////////// CHANGE THESE VALUES //////////////////////
const char* ssid = "SSID"; //Name of your network
const char* password = "PASSWORD"; //Password for your network
const int zones = 8; //Number of zones (max is 9)
const int timeout = 30; //Automatic shutoff time (in minutes)
const char* relay = "HIGH"; //Relay type (`HIGH` or `LOW`)
const char* mdns = "sprinklers"; //mDNS name
//////////////////////////////////////////////////////////////

const int zonePins[10] = {0, 16, 5, 4, 0, 2, 14, 12, 13, 15};
int stateArray[zones + 1], timeArray[zones + 1], relayOn, relayOff, i;

WiFiServer server(80);

void setup() {
  Serial.begin(115200);
  delay(10);

  if (relay == "LOW") {
    relayOn = 0;
    relayOff = 1;
  } else {
    relayOn = 1;
    relayOff = 0;
  }

  for (i = 1; i <= zones; i++) {
    pinMode(zonePins[i], OUTPUT);
    digitalWrite(zonePins[i], relayOff);
    stateArray[i] = 0;
    timeArray[i] = 0;
  }

  // Connect to WiFi network
  Serial.println();
  Serial.println();
  Serial.println("Connecting to \"" + String(ssid) + "\"");

  WiFi.softAPdisconnect(true);
  WiFi.begin(ssid, password);

  i = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(String(++i) + " ");
  }
  Serial.println();
  Serial.println("Connected successfully");

  // Start the server
  server.begin();

  // Print the IP address
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (!MDNS.begin(mdns)) {
    Serial.println("Error setting up MDNS responder!");
  }
  Serial.println("mDNS address: " + String(mdns) + ".local");

}

void loop() {

  MDNS.update();

  for (i = 1; i <= zones; i++) {
    if (millis() - timeArray[i] > timeout * 60000 && stateArray[i] == 1) {
      Serial.println("Zone " + String(i) + " reached timeout. Disabling... ");
      digitalWrite(zonePins[i], relayOff);
      stateArray[i] = 0;
    }
  }

  // Check if a client has connected
  WiFiClient client = server.available();
  if (!client) {
    return;
  }

  // Wait until the client sends some data
  Serial.println("New client");
  while(!client.available()){
    delay(1);
  }

  // Read the first line of the request
  String request = client.readStringUntil('\r');
  Serial.println(request);
  client.flush();

  // Return the response
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html");
  client.println("");

  // Match the request
  if (request.indexOf("/setState") != -1)  {
    int zone = request.substring(5, 6).toInt();
    int value = request.substring(16, 17).toInt();
    stateArray[zone] = value;
    if (value == 1) {
      timeArray[zone] = millis();
      digitalWrite(zonePins[zone], relayOn);
    } else {
      digitalWrite(zonePins[zone], relayOff);
    }
  }

  if (request.indexOf("/status") != -1)  {
    client.print("[");
    for (i = 1; i < zones; i++) {
      client.println("{\"zone\": " + String(i) + ",\"state\": " + String(stateArray[i]) + "},");
    }
    client.println("{\"zone\": " + String(i) + ",\"state\": " + String(stateArray[i]) + "}]");
  }

  delay(1);
  Serial.println("Client disconnected");
  Serial.println("");

}
