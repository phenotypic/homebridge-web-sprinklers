#include <ESP8266WiFi.h>
#include <WiFiClient.h>
#include <ESP8266WebServer.h>
#include <ESP8266mDNS.h>
#include <ArduinoJson.h>

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
const char* ssid = "SSID"; // Name of your network
const char* password = "PASSWORD"; // Password for your network
const int zones = 6; // Number of zones (max is 9)
const int timeout = 15; // Automatic shutoff time (in minutes)
const String relay = "LOW"; // Relay type (`HIGH` or `LOW`)
const char* mdns = "sprinklers"; // mDNS name
//////////////////////////////////////////////////////////////

const int zonePins[10] = {0, 16, 5, 4, 0, 2, 14, 12, 13, 15};

unsigned long timeArray[zones + 1];
int stateArray[zones + 1], relayOn, relayOff, i;

ESP8266WebServer server(80);

void setup() {
  if (relay.equals("LOW")) {
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
    timeArray[i] = millis();
  }

  Serial.begin(115200);
  delay(10);

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

  // Print the IP address
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());

  if (!MDNS.begin(mdns)) {
    Serial.println("Error setting up MDNS responder!");
  }
  Serial.println("mDNS address: " + String(mdns) + ".local");

  server.on("/setState", []() {
    int zone = server.arg("zone").toInt();
    int value = server.arg("value").toInt();
    stateArray[zone] = value;
    if (value) {
      timeArray[zone] = millis();
      digitalWrite(zonePins[zone], relayOn);
    } else {
      digitalWrite(zonePins[zone], relayOff);
    }
    server.send(200);
  });

  server.on("/status", []() {
    size_t capacity = JSON_ARRAY_SIZE(zones) + zones*JSON_OBJECT_SIZE(2);
    DynamicJsonDocument doc(capacity);

    for (i = 1; i <= zones; i++) {
      JsonObject list = doc.createNestedObject();
      list["zone"] = i;
      list["state"] = stateArray[i];
    }

    String json;
    serializeJson(doc, json);
    server.send(200, "application/json", json);
  });

  // Start the server
  server.begin();
}

void loop() {
  server.handleClient();
  MDNS.update();

  for (i = 1; i <= zones; i++) {
    if (millis() - timeArray[i] > (timeout * 60000) && stateArray[i]) {
      Serial.println("Zone " + String(i) + " reached timeout. Disabling... ");
      digitalWrite(zonePins[i], relayOff);
      stateArray[i] = 0;
    }
  }
}
