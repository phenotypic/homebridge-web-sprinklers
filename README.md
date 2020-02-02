# homebridge-web-sprinklers

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

## Description

This [homebridge](https://github.com/nfarina/homebridge) plugin exposes a web-based sprinkler system to Apple's [HomeKit](http://www.apple.com/ios/home/). Using HTTP requests, the plugin allows you to turn on/off individual sprinkler zones. With the use of the [Dark Sky API](https://darksky.net/dev), the plugin can also provide water scheduling.

Find script samples for the sprinkler controller in the _examples_ folder.

## Installation

1. Install [homebridge](https://github.com/nfarina/homebridge#installation-details)
2. Install this plugin: `npm install -g homebridge-web-sprinklers`
3. Sign up (for free) to the [Dark Sky API](https://darksky.net/dev) and retrieve your API key (if you want scheduling)
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
       "longitude": -0.1473213074918931,
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 6,
       "restrictedDays": [2, 4, 6],
       "zonePercentages": [100, 75, 100, 100, 50, 100]
     }
]
```

#### Accessory without scheduling

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
| `key` | Your [Dark Sky API](https://darksky.net/dev) key  | N/A |
| `zones` | Number of sprinkler zones  | `6` |

## Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `disableScheduling` | Whether to disable water scheduling | `false` |
| `sunriseOffset` | Minutes before sunset to finish watering by | `0` |
| `defaultDuration` | Default total watering time per zone (minutes) when adaptive watering is disabled | `5` |
| `cycles` | Number of cycles per zone (watering time is spread between cycles)  | `2` |
| `restrictedDays` | Days of the week when watering should **not** take place (Sunday is `0`, Monday is `1`, and so on) | N/A |
| `restrictedMonths` | Months of the year when watering should **not** take place (January is `0`, February is `1`, and so on) | N/A |
| `rainThreshold` | Percentage chance of rain above which watering will be cancelled | `40` |
| `minTemperature` | Temperature (°C) below which watering will not take place | `10` |
| `disableAdaptiveWatering` | Whether to disable adaptive watering and use `defaultDuration` instead | `false` |
| `maxDuration` | The highest number of minutes that `adaptiveWatering` can set | `30` |
| `zonePercentages` | Percentage of calculated zone watering time that a specific zone will receive | `100` |

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

## Scheduling

When scheduling is enabled, the plugin will schedule watering so that it finishes however many minutes before sunrise specified `sunriseOffset`.

The plugin schedules asynchronous zone watering times (no more than one zone should be on at a given time) as most systems are incapable of supplying sufficient pressure to water multiple zones simultaneously.

Start times will vary daily as a result of changing sunrise times.

## Adaptive watering

When adaptive watering is enabled, the zone watering duration will be calculates simply as a percentage (specified in `zonePercentages`) of the difference between your specified minimum watering temperature and the next day's forecasted maximum temperature.

E.g. If `minTemperature` is `10`, and the maximum forecasted temperature is `25`, the total watering time per zone will be: `25` - `10` = `15` minutes

If adaptive watering is disabled, but scheduling remains enabled, each zone will be watered for a percentage (specified in `zonePercentages`) of the number of minutes specified in `defaultDuration`

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
For an example Zone3 in the ON position would send `/3/setState/1`
### Optional (if listener is enabled)

1. Update `state` following a manual zone override by messaging the listen server:
```
/ZONE_INT_VALUE/state/INT_VALUE
```

## Notes

- If you are using scheduling, the sprinkler controller should have an onboard auto-shutoff feature where the valve will automatically close after a period of time (e.g. `30` minutes) has passed so that valves are not left open if there was an error receiving the 'off message' from the plugin

- I am open to suggestions about new ways to calculate watering times for adaptive watering in place of the simple calculation currently implemented

- The watering times displayed to you within the homebridge log are rounded to make reading them easier due to JavaScript's [floating point calculations](https://www.youtube.com/watch?v=PZRI1IfStY0). The real watering times are not rounded

- Your API key grants you access to `1000` API calls per day. The plugin will only make an API call once per day (as well as whenever homebridge starts up) so you shouldn't need to worry about running out of API calls

## To-do

- [ ] Ensure the main service is set to `In Use` when a valve is active

- [ ] Set `Program Mode` to manual when user manually overrides valve

- [ ] Update `Remaining Duration` accordingly - for main service or for each valve?
