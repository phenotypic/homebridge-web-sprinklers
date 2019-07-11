# NodeMCU sprinkler controller

## Description

This script interfaces with the plugin to expose the web-based sprinkler system. A maximum of 9 zones is supported by the script.

## Requirements

* NodeMCU

* Relay board

* Micro-USB cable

## How-to

1. First, follow [this](https://gist.github.com/Tommrodrigues/8d9d3b886936ccea9c21f495755640dd) gist which walks you through how to flash a NodeMCU. The `.ino` file referred to in the gist is the `NodeMCU-Sprinklers.ino` file included in this repository

2. Connect the NodeMCU to the relay board

3. Assuming that you already have [homebridge](https://github.com/nfarina/homebridge#installation) set up, the next thing you will have to do is install the plugin using the following command:
```
npm install -g homebridge-web-sprinklers
```

4. Finally, update your `config.json` file following the example below:

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://myurl.com",
       "town": "London",
       "country": "UK",
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 4
     }
]
```

## Wiring

Wiring is fairly simple for relays but specifics will vary between sprinkler setups. Usually, sprinkler valves are 24V AC, so connect all valve common wires to one electrode and then the others to the relay board (connected to the other electrode)
