# homebridge-web-sprinklers _(Under Development)_

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin controls a web-based sprinkler system and exposes it to Apple's [HomeKit](http://www.apple.com/ios/home/). Using simple HTTP requests and the [Apixu API](https://www.apixu.com), the plugin schedules watering and allows you to monitor and turn on/off individual sprinkler zones.

Both the watering staart time and the watering duration for each zone will be calculated by the plugin each day taking into account local weather conditions.

## Installation

1. Install [homebridge](https://github.com/nfarina/homebridge#installation-details)
2. Install this plugin: `npm install -g homebridge-web-sprinklers`
3. Sign up to the [Apixu API](https://www.apixu.com)
4. Update your `config.json` file

## Configuration

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://myurl.com",
       "town": "London",
       "country": "UK",
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 8
     }
]
```

### Core
| Key | Description | Default |
| --- | --- | --- |
| `accessory` | Must be `HTTP-RGB` | N/A |
| `name` | Name to appear in the Home app | N/A |
| `apiroute` | Root URL of your device | N/A |
| `town` | Your nearest town | N/A |
| `country` | Your country code | N/A |
| `key` | Your [Apixu API](https://www.apixu.com) key  | N/A |
| `zones` | Number of sprinkler zones  | `3` |

## Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `enableSchedule` _(optional)_ | Whether or not to enable scheduling  | `true` |
| `defaultDuration` _(optional)_ | Default total watering time per zone (in minutes)  | `10` |
| `cycles` _(optional)_ | Number of cycles per zone (calculated watering time is spread between cycles)  | `2` |
| `rainThreshold` _(optional)_ | Rain threshold (in inches) at which watering will be cancelled | `0.05` |
| `lowThreshold` _(optional)_ | Temperature (°C) below which watering will be cancelled | `10` |
| `highThreshold` _(optional)_ | Temperature (°C) above which the default watering time will be increased by `heatMultiplier` | `20` |
| `heatMultiplier` _(optional)_ | Amount default watering time will be multiplied by if the max temperature is above `highThreshold`| `2` |
| `sunriseOffset` _(optional)_ | Minutes before sunset to finish schedule by | `60` |
| **(NEED TO IMPLEMENT)** `pollInterval` _(optional)_ | Time (in seconds) between device polls | `300` |
| `listener` _(optional)_ | Whether to start a listener to get real-time changes from the device | `false` |

### Additional options
| Key | Description | Default |
| --- | --- | --- |
| `timeout` _(optional)_ | Time (in milliseconds) until the accessory will be marked as _Not Responding_ if it is unreachable | `3000` |
| `port` _(optional)_ | Port for your HTTP listener (if enabled) | `2000` |
| `http_method` _(optional)_ | HTTP method used to communicate with the device | `GET` |
| `username` _(optional)_ | Username if HTTP authentication is enabled | N/A |
| `password` _(optional)_ | Password if HTTP authentication is enabled | N/A |
| `model` _(optional)_ | Appears under the _Model_ field for the accessory | plugin |
| `serial` _(optional)_ | Appears under the _Serial_ field for the accessory | apiroute |
| `manufacturer` _(optional)_ | Appears under the _Manufacturer_ field for the accessory | author |
| `firmware` _(optional)_ | Appears under the _Firmware_ field for the accessory | version |

## API Interfacing

Your API should be able to:

1. **(NEED TO IMPLEMENT)** Return JSON information when it receives `/status` where `zone` is the zone number:
```
{
    "zone": INT_VALUE,
    "zone": INT_VALUE,
    "zone": INT_VALUE,
    ...
}
```

2. Set zone state when it receives:
```
/zone/setState/INT_VALUE
```

### Optional (if listener is enabled)

1. Update `state` following a manual zone override by messaging the listen server:
```
/zone/state/INT_VALUE
```

## Notes

- The recieving device should have an automatic shutoff feature where the valve will automatically close after a period of time (e.g. 30 minutes) just incase the shutoff message was not recieved due to a connection issue

- Watering needs vary widely as a result of a number of factors including sprinkler output, lawn type and local conditions. The plugin will schedule a watering cycle every day (assuming certain thresholds are not met) and may therefore be unsuitable if you need to limit watering to a certain number of days each week (unless you disable scheduling)

- By default, turning a valve on manually within the app will turn it off after the number of minutes you have defined for `defaultDuration`. You can change this manual duration from within the Home app for each zone. This will **not** affect the watering time calculated by the plugin for the schedule
