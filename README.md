<p align="center">
  <a href="https://github.com/homebridge/homebridge"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

<span align="center">

# homebridge-web-sprinklers

[![npm](https://img.shields.io/npm/v/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers) [![npm](https://img.shields.io/npm/dt/homebridge-web-sprinklers.svg)](https://www.npmjs.com/package/homebridge-web-sprinklers)

</span>

## Description

This [homebridge](https://github.com/homebridge/homebridge) plugin exposes a web-based sprinkler system to Apple's [HomeKit](http://www.apple.com/ios/home/). Using HTTP requests, the plugin allows you to turn on/off individual sprinkler zones. With the use of the [OpenWeatherMap API](https://openweathermap.org/api), the plugin can also provide water scheduling.

Find script samples for the sprinkler controller in the _examples_ folder.

## Installation

1. Install [homebridge](https://github.com/homebridge/homebridge#installation)
2. Install this plugin: `npm install -g homebridge-web-sprinklers`
3. Sign up (for free) to the [OpenWeatherMap API](https://openweathermap.org/api) and retrieve your API key (if you want scheduling)
4. Update your `config.json` file

## Configuration

#### Accessory with scheduling

```json
"accessories": [
     {
       "accessory": "WebSprinklers",
       "name": "Sprinklers",
       "apiroute": "http://myurl.com",
       "latitude": 0000000000,
       "longitude": 0000000000,
       "key": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
       "zones": 6,
       "restrictedMonths": [0, 1, 2, 10, 11],
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
| `key` | Your [OpenWeatherMap API](https://openweathermap.org/api) key  | N/A |
| `zones` | Number of sprinkler zones  | `6` |

### Optional fields
| Key | Description | Default |
| --- | --- | --- |
| `disableScheduling` | Whether to disable water scheduling | `false` |
| `sunriseOffset` | Minutes before sunset to finish watering by | `0` |
| `defaultDuration` | Default total watering time per zone (minutes) | `20` |
| `cycles` | Number of cycles per zone (watering is spread between cycles)  | `2` |
| `restrictedDays` | Days of the week when watering should **not** take place (Sunday is `0`, Monday is `1`, and so on) | N/A |
| `restrictedMonths` | Months of the year when watering should **not** take place (January is `0`, February is `1`, and so on) | N/A |
| `zonePercentages` | Percentage of calculated zone watering time that a specific zone will receive (do not exceed 100%) | `100` |
| `disableAdaptiveWatering` | Whether to disable adaptive watering and use `defaultDuration` instead | `false` |
| `maxDuration` | The highest number of minutes that `adaptiveWatering` can set | `30` |
| `lowThreshold` | Forecasted low temperature (°C) below which watering will not take place | `10` |
| `highThreshold` | Forecasted high temperature (°C) below which watering will not take place | `20` |
| `rainThreshold` | Forecasted rainfall (mm) above which watering will not take place | `2.3` |

### Additional options
| Key | Description | Default |
| --- | --- | --- |
| `pollInterval` | Time (in seconds) between device polls | `300` |
| `listener` | Whether to start a listener to get real-time changes from the device | `false` |
| `timeout` | Time (in milliseconds) until the accessory will be marked as _Not Responding_ if it is unreachable | `3000` |
| `port` | Port for your HTTP listener (if enabled) | `2000` |
| `username` | Username if HTTP authentication is enabled | N/A |
| `password` | Password if HTTP authentication is enabled | N/A |
| `http_method` | HTTP method used to communicate with the device | `GET` |
| `model` | Appears under the _Model_ field for the accessory | plugin |
| `serial` | Appears under the _Serial_ field for the accessory | apiroute |
| `manufacturer` | Appears under the _Manufacturer_ field for the accessory | author |
| `firmware` | Appears under the _Firmware_ field for the accessory | version |

## Scheduling

When scheduling is enabled, the plugin will see if watering can be completed today by however many minutes before sunrise  specified in `sunriseOffset`, if not, it will schedule the relevant time for the next day.

The day selected must match the following criteria for watering to place:

- Not a restricted day/month
- Forecasted rain for today and tomorrow not higher than threshold
- Forecasted low and high temperature higher than their respective thresholds

If adaptive watering is disabled, but scheduling remains enabled, each zone will be watered for a percentage (specified in `zonePercentages`) of the number of minutes specified in `defaultDuration`

The plugin schedules asynchronous zone watering times (no more than one zone on at a given time), as most systems are incapable of supplying sufficient pressure to water multiple zones simultaneously.

Start times will vary daily as a result of changing sunrise times.

## Adaptive watering

When adaptive watering is enabled, a zone's total watering duration will be calculated as a percentage (specified in `zonePercentages`) of the calculation below:

```js
highDiff = waterDay.max - highThreshold
lowDiff = highThreshold - waterDay.min
cloudPercentage = 100 - (waterDay.clouds / 3)
zoneMaxDuration = (((defaultDuration + (highDiff - lowDiff)) / 100) * cloudPercentage) - waterDay.rain
```

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
/setState?zone=ZONE_INT_VALUE&value=INT_VALUE
```

### Optional (if listener is enabled)

1. Update `state` following a manual zone override by messaging the listen server:
```
/state?zone=ZONE_INT_VALUE&value=INT_VALUE
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
