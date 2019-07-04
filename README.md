# homebridge-web-sprinklers _(Under Development)_

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin controls a web-based sprinkler system and exposes it to Apple's [HomeKit](http://www.apple.com/ios/home/). Using simple HTTP requests and the [Apixu API](https://www.apixu.com), the plugin schedules watering and allows you to monitor and turn on/off individual sprinkler zones.

Watering will be scheduled by the plugin to end just before the next sunrise, assuming that it will not rain in the next 2 days and that the temperature is not too low. If scheduled, watering will be adjusted according to the tempearture then divided up into a number of passes to prevent run-off. Only one zone will be activated at a time to maintain sufficient water pressure.

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
| `defaultDuration` | Default total watering time per zone (in minutes)  | `20` |
| `cycles` | Number of cycles per zone (total watering time is spread between cycles)  | `2` |
| `rainThreshold` | Rain threshold (in inches) at which watering will be cancelled | `0.05` |
| `lowThreshold` | Temperature (°C) below which watering will be cancelled | `10` |
| `highThreshold` | Temperature (°C) above which 100% of watering time will occur (reduced by `coldPercentage` otherwise) | `20` |
| `reductionPercentage` | Percentage by which watering time will be reduced by if `highThreshold` has not been met | `50` |
| `sunriseOffset` | Minutes before sunset that watering must finish before | `60` |
| **(NEED TO IMPLEMENT)** `pollInterval` _(optional)_ | Time (in seconds) between device polls | `300` |
| `listener` | Whether to start a listener to get real-time changes from the device | `false` |

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
