var Service, Characteristic
const packageJson = require('./package.json')
const schedule = require('node-schedule')
const request = require('request')
const ip = require('ip')
const http = require('http')

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-web-sprinklers', 'WebSprinklers', WebSprinklers)
}

function WebSprinklers (log, config) {
  this.log = log

  this.name = config.name
  this.apiroute = config.apiroute
  this.zones = config.zones || 6
  this.pollInterval = config.pollInterval || 300

  this.listener = config.listener || false
  this.port = config.port || 2000
  this.requestArray = ['state']

  this.disableScheduling = config.disableScheduling || false
  this.disableAdaptiveWatering = config.disableAdaptiveWatering || false

  this.latitude = config.latitude
  this.longitude = config.longitude
  this.key = config.key

  this.restrictedDays = config.restrictedDays || []
  this.restrictedMonths = config.restrictedMonths || []
  this.sunriseOffset = config.sunriseOffset || 0
  this.cloudCancel = config.cloudCancel || 55

  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20

  this.defaultDuration = config.defaultDuration || 20
  this.maxDuration = config.maxDuration || 30

  this.cycles = config.cycles || 2

  this.zonePercentages = config.zonePercentages || new Array(this.zones).fill(100)

  this.valveAccessory = []
  this.zoneDuration = []

  this.manufacturer = config.manufacturer || packageJson.author.name
  this.serial = config.serial || this.apiroute
  this.model = config.model || packageJson.name
  this.firmware = config.firmware || packageJson.version

  this.username = config.username || null
  this.password = config.password || null
  this.timeout = config.timeout || 3000
  this.http_method = config.http_method || 'GET'

  if (this.username != null && this.password != null) {
    this.auth = {
      user: this.username,
      pass: this.password
    }
  }

  if (this.listener) {
    this.server = http.createServer(function (request, response) {
      var parts = request.url.split('/')
      var partOne = parts[parts.length - 3]
      var partTwo = parts[parts.length - 2]
      var partThree = parts[parts.length - 1]
      if (parts.length === 4 && this.requestArray.includes(partTwo) && partThree.length === 1) {
        this.log('Handling request: %s', request.url)
        response.end('Handling request')
        this._httpHandler(partOne, partTwo, partThree)
      } else {
        this.log.warn('Invalid request: %s', request.url)
        response.end('Invalid request')
      }
    }.bind(this))

    this.server.listen(this.port, function () {
      this.log('Listen server: http://%s:%s', ip.address(), this.port)
    }.bind(this))
  }

  this.service = new Service.IrrigationSystem(this.name)
}

WebSprinklers.prototype = {

  identify: function (callback) {
    this.log('Identify requested!')
    callback()
  },

  _httpRequest: function (url, body, method, callback) {
    request({
      url: url,
      body: body,
      method: this.http_method,
      timeout: this.timeout,
      rejectUnauthorized: false,
      auth: this.auth
    },
    function (error, response, body) {
      callback(error, response, body)
    })
  },

  _getStatus: function (callback) {
    var url = this.apiroute + '/status'
    this.log.debug('Getting status: %s', url)

    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting status: %s', error.message)
        this.service.getCharacteristic(Characteristic.Active).updateValue(new Error('Polling failed'))
        callback(error)
      } else {
        this.service.getCharacteristic(Characteristic.Active).updateValue(1)
        this.log.debug('Device response: %s', responseBody)
        var json = JSON.parse(responseBody)

        for (var zone = 1; zone <= this.zones; zone++) {
          var value = json[zone - 1].state
          this.log('Zone %s | Updated state to: %s', zone, value)
          this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
          this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        }
        callback()
      }
    }.bind(this))
  },

  _httpHandler: function (zone, characteristic, value) {
    switch (characteristic) {
      case 'state':
        this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        this.log('Zone %s | Updated %s to: %s', zone, characteristic, value)
        break
      default:
        this.log.warn('Zone %s | Unknown characteristic "%s" with value "%s"', zone, characteristic, value)
    }
  },

  _calculateSchedule: function (callback) {
    var url = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + this.latitude + '&lon=' + this.longitude + '&exclude=current,hourly&units=metric&appid=' + this.key
    this.log.debug('Retrieving weather data: %s', url)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting weather data: %s', error)
        setTimeout(() => {
          this._calculateSchedule(function () {})
        }, 60000)
        callback(error)
      } else {
        this.log.debug('Weather data: %s', responseBody)
        try {
          var json = JSON.parse(responseBody)
        } catch (error) {
          setTimeout(() => {
            this._calculateSchedule(function () {})
          }, 60000)
          return this.log.error('Error parsing weather data: %s', error)
        }
        var today = json.daily[0]
        var tomorrow = json.daily[1]

        var todaySummary = today.weather[0].description
        var todaySunrise = new Date(today.sunrise * 1000)
        var todayMin = today.temp.min
        var todayMax = today.temp.max
        var todayRain = 'rain' in today
        var todayCloud = today.clouds

        var tomorrowSummary = tomorrow.weather[0].description
        var tomorrowSunrise = new Date(tomorrow.sunrise * 1000)
        var tomorrowMin = tomorrow.temp.min
        var tomorrowMax = tomorrow.temp.max
        var tomorrowRain = 'rain' in tomorrow
        var tomorrowCloud = tomorrow.clouds

        this.log('----------------------------------------------')
        this.log('Today summary: %s', todaySummary)
        this.log('Today sunrise: %s', todaySunrise.toLocaleString())
        this.log('Today min temp: %s °C', todayMin)
        this.log('Today max temp: %s °C', todayMax)
        this.log('Today rain: %s', todayRain)
        this.log('Today cloud cover: %s %', todayCloud)
        this.log('----------------------------------------------')
        this.log('Tomorrow summary: %s', tomorrowSummary)
        this.log('Tomorrow sunrise: %s', tomorrowSunrise.toLocaleString())
        this.log('Tomorrow min temp: %s °C', tomorrowMin)
        this.log('Tomorrow max temp: %s °C', tomorrowMax)
        this.log('Tomorrow rain: %s', tomorrowRain)
        this.log('Tomorrow cloud cover: %s %', tomorrowCloud)
        this.log('----------------------------------------------')

        if (!this.restrictedDays.includes(tomorrowSunrise.getDay()) && !this.restrictedMonths.includes(tomorrowSunrise.getMonth()) && !todayRain && !tomorrowRain && tomorrowMin > this.lowThreshold && tomorrowMax > this.highThreshold && tomorrowCloud < this.cloudCancel) {
          if (!this.disableAdaptiveWatering) {
            var highDiff = (tomorrowMax - this.highThreshold) / 2
            var lowDiff = this.highThreshold - tomorrowMin
            var zoneMaxDuration = ((this.defaultDuration + (highDiff - lowDiff)) / 100) * (100 - tomorrowCloud)
            if (zoneMaxDuration > this.maxDuration) {
              zoneMaxDuration = this.maxDuration
            }
          } else {
            zoneMaxDuration = this.defaultDuration
          }

          for (var zone = 1; zone <= this.zones; zone++) {
            this.zoneDuration[zone] = ((zoneMaxDuration / this.cycles) / 100) * this.zonePercentages[zone - 1]
          }

          var totalTime = this.zoneDuration.reduce((a, b) => a + b, 0) * this.cycles

          var startTime = new Date(tomorrowSunrise.getTime() - (totalTime + this.sunriseOffset) * 60000)
          var finishTime = new Date(startTime.getTime() + totalTime * 60000)

          this.log('Total watering time: %s minutes', Math.round(totalTime))
          this.log('Watering starts: %s', startTime.toLocaleString())
          this.log('Watering finishes: %s', finishTime.toLocaleString())
          this.log('Base watering time: %s minutes', Math.round(zoneMaxDuration))
          this.log('----------------------------------------------')

          for (zone = 1; zone <= this.zones; zone++) {
            this.log('Zone %s | %sx %s minute cycles', zone, this.cycles, Math.round(this.zoneDuration[zone]))
          }

          schedule.scheduleJob(startTime, function () {
            this.log('Starting water cycle 1/%s', this.cycles)
            this._wateringCycle(1, 1)
          }.bind(this))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
        } else {
          this.log('No schedule set, recalculation: %s', tomorrowSunrise.toLocaleString())
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          schedule.scheduleJob(tomorrowSunrise, function () {
            this._calculateSchedule(function () {})
          }.bind(this))
        }
        this.log('----------------------------------------------')
        callback()
      }
    }.bind(this))
  },

  _wateringCycle: function (zone, cycle) {
    this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 1)
    setTimeout(() => {
      this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 0)
      var nextZone = zone + 1
      if (nextZone <= this.zones) {
        this._wateringCycle(nextZone, cycle)
      } else {
        var nextCycle = cycle + 1
        if (nextCycle <= this.cycles) {
          this._wateringCycle(1, nextCycle)
          this.log('Starting watering cycle %s/%s', nextCycle, this.cycles)
        } else {
          this.log('Watering finished')
          this._calculateSchedule(function () {})
        }
      }
    }, this.zoneDuration[zone] * 60000)
  },

  setActive: function (zone, value, callback) {
    var url = this.apiroute + '/' + zone + '/setState/' + value
    this.log.debug('Zone %s | Setting state: %s', zone, url)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Zone %s | Error setting state: %s', zone, error.message)
        callback(error)
      } else {
        this.log('Zone %s | Set state to %s', zone, value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        callback()
      }
    }.bind(this))
  },

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
    this.service.getCharacteristic(Characteristic.Active).updateValue(1)
    this.service.getCharacteristic(Characteristic.InUse).updateValue(0)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    var services = [this.informationService, this.service]
    for (var zone = 1; zone <= this.zones; zone++) {
      var accessory = new Service.Valve('Zone', zone)
      accessory
        .setCharacteristic(Characteristic.ServiceLabelIndex, zone)
        .setCharacteristic(Characteristic.ValveType, 1)

      accessory
        .getCharacteristic(Characteristic.Active)
        .on('set', this.setActive.bind(this, zone))

      this.valveAccessory[zone] = accessory
      this.service.addLinkedService(accessory)
      services.push(accessory)
    }
    this.log('Initialized %s zones', this.zones)

    if (!this.disableScheduling) {
      this._calculateSchedule(function () {})
    }

    this._getStatus(function () {})

    setInterval(function () {
      this._getStatus(function () {})
    }.bind(this), this.pollInterval * 1000)

    return services
  }

}
