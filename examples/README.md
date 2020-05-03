## Description

This script is designed to interface with the plugin to expose the web-based sprinkler system with the use of a relay board. A maximum of 9 zones can be controlled using this script.

## Requirements

* NodeMCU

* Relay board

* Micro-USB cable

## How-to

1. First, follow [this](https://gist.github.com/Tommrodrigues/8d9d3b886936ccea9c21f495755640dd) gist which walks you through how to flash a NodeMCU. The `.ino` file referred to in the gist is the `NodeMCU-Sprinklers.ino` file included in this repository

2. Connect the NodeMCU to the relay board

3. Assuming that you already have [homebridge](https://github.com/nfarina/homebridge#installation) set up, the next thing you will have to do is install the plugin:
```
npm install -g homebridge-web-sprinklers
```

4. Finally, update your `config.json` file following the example below:

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://sprinklers.local",
       "latitude": 0000000000,
       "longitude": 0000000000,
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 6
     }
]
```

## Wiring

Most sprinkler valves run on AC power. You should connect all common wires from all zones to one of the AC source electrodes. Link together all relay common terminals and have them connect to the other AC source electrode. Connect the remaining individual zone wires to the _Normally Open_ terminals on the relay board. Finally, wire up the NodeMCU 3.3V pin to the relay board VCC and the ground pin to ground and then hook up each of the zone pins from the NodeMCU to the corresponding activation pins on the relay board.
