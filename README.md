# homebridge-web-sprinklers

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a web-based sprinkler system to Apple's [HomeKit](http://www.apple.com/ios/home/). Using simple HTTP requests, the plugin allows you to turn on/off individual sprinkler zones. With the use of the [Apixu API](https://www.apixu.com), the plugin can also provide scheduling for your sprinkler system.

Watering start times and the watering durations can be (and are by default) calculated by the plugin, taking into account local weather conditions and user-specified values.

Find script samples for the valve controller in the _examples_ folder.

## Installation

1. Install [homebridge](https://github.com/nfarina/homebridge#installation-details)
2. Install this plugin: `npm install -g homebridge-web-sprinklers`
3. Sign up (for free) to the [Apixu API](https://www.apixu.com) and retrieve your API key (if you want scheduling)
4. Update your `config.json` file

## Configuration

#### Accessory with scheduling

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://myurl.com",
       "town": "London",
       "country": "UK",
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 4,
       "restrictedDays": [2, 4, 6],
       "restrictedMonths": [0, 1, 10, 11]
     }
]
```

#### Accessory only

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://myurl.com",
       "scheduling": "no"
     }
]
```

### Core
| Key | Description | Default |
| --- | --- | --- |
| `accessory` | Must be `WebSprinklers` | N/A |
| `name` | Name to appear in the Home app | N/A |
| `apiroute` | Root URL of your device | N/A |
| `town` | Your nearest town | N/A |
| `country` | Your country code | N/A |
| `key` | Your [Apixu API](https://www.apixu.com) key  | N/A |
| `zones` | Number of sprinkler zones  | `3` |

## Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `scheduling` _(optional)_ | Whether or not to enable scheduling (`yes`/`no`)  | `yes` |
| `defaultDuration` _(optional)_ | Default total watering time per zone (in minutes)  | `10` |
| `cycles` _(optional)_ | Number of cycles per zone (calculated watering time is spread between cycles)  | `2` |
| `restrictedDays` _(optional)_ | Days of the week when watering should **not** take place (Sunday is `0`, Monday is `1`, and so on) | N/A |
| `restrictedMonths` _(optional)_ | Months of the year when watering should **not** take place (January is `0`, February is `1`, and so on) | N/A |
| `rainThreshold` _(optional)_ | Rain threshold (in inches) at which watering will be cancelled | `0.3` |
| `lowThreshold` _(optional)_ | Temperature (°C) below which watering will be cancelled | `10` |
| `highThreshold` _(optional)_ | Temperature (°C) above which the default watering time will be increased by `heatMultiplier` | `20` |
| `heatMultiplier` _(optional)_ | Amount default watering time will be multiplied by if the max temperature is above `highThreshold`| `2` |
| `sunriseOffset` _(optional)_ | Minutes before sunset to finish schedule by | `60` |
| `pollInterval` _(optional)_ | Time (in seconds) between device polls | `300` |
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

1. Return JSON information when it receives `/status`:
```
[
  {
    "zone": 1,
    "state": 0
  },
  {
    "zone": 2,
    "state": 0
  },
  {
    "zone": 3,
    "state": 0
  },
  ...
]
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

- The sprinkler controller itself should have an automatic shutoff feature where the valve will automatically close after a period of time (e.g. `30` minutes) so the valve is not left open if there was an error recieving the shut off message from the plugin

- Watering needs vary widely as a result of a number of factors including sprinkler output volume, lawn type and local weather conditions. Feel free to adjust the fields mentioned [above](#optional-fields) for scheduling better adapted to your needs or open an issue/pull request for further feature propositions

- Your [Apixu API](https://www.apixu.com) key grants you access to `10000` API calls per month (>`300` per day). The plugin will only make an API call once per day (as well as when homebridge starts up)
