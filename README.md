# homebridge-web-sprinklers

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a web-based sprinkler system to Apple's [HomeKit](http://www.apple.com/ios/home/). Using HTTP requests, the plugin allows you to turn on/off individual sprinkler zones. With the use of the [Apixu API](https://www.apixu.com), the plugin can also provide water scheduling.

Find script samples for the sprinkler controller in the _examples_ folder.

## Scheduling

When scheduling is enabled, the plugin will ensure that watering finishes however many minutes before sunrise you specify in `sunriseOffset`. Therefore, the start time will vary daily as a result of changing sunrise times and may also be affected by individual zone watering times (see below).

E.g. If you have `2` zones and each zone will take `20` minutes to water, sunrise is at `07:40` and `sunriseOffset` is `60`, the watering start time will be: (`07:40` - `60`) - (`2` * `20`) = `05:00`

When adaptive watering is enabled, total zone watering time will be decided between a certain range. The difference will be calculated between the maximum forcasted temperature for that day and `minTemperature`, then it will be added to `defaultDuration`. 

E.g. If `defaultDuration` is `10`, `minTemperature` is `10` and the maximum forecasted temperature is `25`, the total watering time per zone will be: `10` + (`25` - `10`) = `25` minutes

**Note:** If adaptive watering is disabled but scheduling remains active, each zone will be watered for the number of minutes specified in `defaultDuration`

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
       "latitude": 51.501562114913995,
       "londitude": -0.1473213074918931,
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
       "disableScheduling": true
     }
]
```

### Core
| Key | Description | Default |
| --- | --- | --- |
| `accessory` | Must be `WebSprinklers` | N/A |
| `name` | Name to appear in the Home app | N/A |
| `apiroute` | Root URL of your device | N/A |
| `latitude` | Your decimal latitude | N/A |
| `longitude` | Your decimal longitude | N/A |
| `key` | Your [Apixu API](https://www.apixu.com) key  | N/A |
| `zones` | Number of sprinkler zones  | `6` |

## Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `disableScheduling` | Whether to disable water scheduling | `false` |
| `sunriseOffset` | Minutes before sunset to finish watering by | `0` |
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

## Notes

- If you are using scheduling, the sprinkler controller should have an auto-shutoff feature where the valve will automatically close after a period of time (e.g. `30` minutes) has passed so that valves are not left open if there was an error recieving the off message from the plugin

- Your [Apixu API](https://www.apixu.com) key grants you access to `10000` API calls per month (>`300` per day). The plugin will only make an API call once per day (as well as when homebridge starts up) so you do not need to worry about running out of API calls.
