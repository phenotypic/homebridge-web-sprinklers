# homebridge-web-sprinklers

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a web-based sprinkler system to Apple's [HomeKit](http://www.apple.com/ios/home/). Using simple HTTP requests, the plugin allows you to turn on/off individual sprinkler zones. With the use of the [Apixu API](https://www.apixu.com), the plugin can also provide scheduling for your sprinkler system.

Watering start times and the watering durations can be (and are by default) calculated by the plugin, taking into account local weather conditions and user-specified values.

Find script samples for the sprinkler controller in the _examples_ folder.

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
       "zones": 6,
       "restrictedDays": [2, 4, 6]
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
| `town` | Your nearest town (can include spaces) | N/A |
| `country` | Your country code | N/A |
| `key` | Your [Apixu API](https://www.apixu.com) key  | N/A |
| `zones` | Number of sprinkler zones  | `6` |

## Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `disableScheduling` | Whether to disable water scheduling | `false` |
| `sunriseOffset` | Minutes before sunset to finish watering by | `60` |
| `defaultDuration` | Default total watering time per zone (in minutes)  | `10` |
| `cycles` | Number of cycles per zone (watering time is spread between cycles)  | `2` |
| `restrictedDays` | Days of the week when watering should **not** take place (Sunday is `0`, Monday is `1`, and so on) | N/A |
| `restrictedMonths` | Months of the year when watering should **not** take place (January is `0`, February is `1`, and so on) | N/A |
| `rainThreshold` | Rain (in inches) above which watering will not take place | `0.03` |
| `minTemperature` | Temperature (°C) below which watering will not take place | `10` |
| `disableAdaptiveWatering` | Whether to disable adaptive watering | `false` |
| `maxDuration` | The highest number of minutes that `adaptiveWatering` can set | `30` |

### Additional options
| Key | Description | Default |
| --- | --- | --- |
| `pollInterval` | Time (in seconds) between device polls | `300` |
| `listener` | Whether to start a listener to get real-time changes from the device | `false` |
| `timeout` | Time (in milliseconds) until the accessory will be marked as _Not Responding_ if it is unreachable | `3000` |
| `port` | Port for your HTTP listener (if enabled) | `2000` |
| `http_method` | HTTP method used to communicate with the device | `GET` |
| `username` | Username if HTTP authentication is enabled | N/A |
| `password` | Password if HTTP authentication is enabled | N/A |
| `model` | Appears under the _Model_ field for the accessory | plugin |
| `serial` | Appears under the _Serial_ field for the accessory | apiroute |
| `manufacturer` | Appears under the _Manufacturer_ field for the accessory | author |
| `firmware` | Appears under the _Firmware_ field for the accessory | version |

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

## Scheduling

When scheduling is enabled, the plugin will ensure that watering finishes however many minutes before sunrise you specify in `sunriseOffset`. Therefore, the start time will vary daily as a result of changing sunrise times and may also be affected by individual zone watering times (see below).

When adaptive watering is enabled, the difference between the maximum temperature for that day and the minimum watering temperature in the plugin will be added to the default watering duration for each zone. Thus, watering times will increase as a result of higher temperatures.
## Notes

- The sprinkler controller itself should have an automatic shutoff feature where the valve will automatically close after a period of time (e.g. `30` minutes) so valves are not left open if there was an error recieving the shut off message from the plugin

- Your [Apixu API](https://www.apixu.com) key grants you access to `10000` API calls per month (>`300` per day). The plugin will only make an API call once per day (as well as when homebridge starts up)
