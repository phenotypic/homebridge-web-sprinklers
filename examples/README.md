## Description

This script is designed to interface with the plugin to expose the web-based sprinkler system with the use of a relay board. A maximum of 9 zones can be controlled using this script.

## Requirements

* NodeMCU

* Relay board

* Micro-USB cable

## How-to

1. First, install the `ArduinoJson` library from the _Library manager_ in the Arduino IDE, then follow [this](https://gist.github.com/phenotypic/8d9d3b886936ccea9c21f495755640dd) gist which walks you through how to flash a NodeMCU. The `.ino` file referred to in the gist is the `NodeMCU-Sprinklers.ino` file included in this repository

2. Connect the NodeMCU to the relay board

3. Assuming that you already have [homebridge](https://github.com/homebridge/homebridge#installation) set up, the next thing you will have to do is install the plugin:
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

**NOTE:** Take necessary precautions to avoid the possibility of electrocution by mains power

- Most sprinkler valves run on AC power (usually 12-24V)
- First link together all 'common' wires from your zone valves to one of the AC power lines
- Next link together all of 'common' terminals from the relay board to the other AC power line
- Then connect the individual zone valve wires to the _Normally Open_ terminals on the relay board
- Finally, hook up each of the zone pins from the NodeMCU to the corresponding activation pins on the relay board, then wire the NodeMCU 3.3V pin to the relay board VCC and the ground pin to ground
- See the example below which shows the wiring for 3 zones:

| NodeMCU | Relay Board (Relay #: `connection`) | Zone Valves (Zone #: `connection`) | AC Power |
| --- | --- | --- | --- |
| | | 1: `Common` | `Line 1` |
| | | 2: `Common` | `Line 1` |
| | | 3: `Common` | `Line 1` |
| | 1: `Common` | | `Line 2` |
| | 2: `Common` | | `Line 2` |
| | 3: `Common` | | `Line 2` |
| | 1: `Normally Open` | 1: `Activator` | |
| | 2: `Normally Open` | 2: `Activator` | |
| | 3: `Normally Open` | 3: `Activator` | |
| `D0` | 1: `IN1` | | |
| `D1` | 2: `IN1` | | |
| `D2` | 3: `IN1` | | |
| `3V3` | `VCC` | | |
| `GND` | `GND` | | |
