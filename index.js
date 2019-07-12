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
  this.zones = config.zones || 3
  this.pollInterval = config.pollInterval || 300

  this.listener = config.listener || false
  this.port = config.port || 2000
  this.requestArray = ['state']

  this.scheduling = config.scheduling || true
  this.town = config.town
  this.country = config.country
  this.key = config.key

  this.restrictedDays = config.restrictedDays || []
  this.defaultDuration = config.defaultDuration || 10
  this.cycles = config.cycles || 2
  this.rainThreshold = config.rainThreshold || 0.3
  this.sunriseOffset = config.sunriseOffset || 60
  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20
  this.heatMultiplier = config.heatMultiplier || 2

  this.wateringDuration = this.defaultDuration
  this.scheduledWateringTime = null
  this.valveAccessory = []

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
    this.log('Getting status: %s', url)

    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting status: %s', error.message)
        this.service.getCharacteristic(Characteristic.Active).updateValue(new Error('Polling failed'))
        callback(error)
      } else {
        this.log('Device response: %s', responseBody)
        var json = JSON.parse(responseBody)

        for (var zone = 1; zone <= this.zones; zone++) {
          var value = json[zone - 1].state
          this.log('Zone %s | Updating state to: %s', zone, value)
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
        this.log('Zone %s | Updating %s to: %s', zone, characteristic, value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        break
      default:
        this.log.warn('Zone %s | Unknown characteristic "%s" with value "%s"', zone, characteristic, value)
    }
  },

  _dateExtraction: function (value, format) {
    var date = (value.getMonth() + 1) + '/' + value.getDate() + '/' + value.getFullYear()
    var time = value.getHours() + ':' + value.getMinutes() + ':' + value.getSeconds()
    switch (format) {
      case 'date':
        return date
      case 'time':
        return time
      case 'full':
        return time + ' ' + date
      default:
        return 'UNKNOWN FORMAT: ' + format
    }
  },

  _calculateSchedule: function (callback) {
    var url = 'https://api.apixu.com/v1/forecast.json?key=' + this.key + '&q=' + this.town + ',' + this.country + '&days=2'
    this.log('Retrieving weather data for %s (%s)', this.town, this.country)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting weather data: %s', error)
        this.log.warn('Retrying in 1 minute...')
        setTimeout(() => {
          this._calculateSchedule(function () {})
        }, 60000)
        callback(error)
      } else {
        this.log.debug(responseBody)
        var json = JSON.parse(responseBody)
        var day1 = json.forecast.forecastday[0]
        var day2 = json.forecast.forecastday[1]

        var todayDate = day1.date
        var todaySunrise = day1.astro.sunrise.substring(0, 5)
        var tomorrowDate = day2.date
        var tomorrowSunrise = day2.astro.sunrise.substring(0, 5)

        var todayCondition = day1.day.condition.text
        var todayRain = day1.day.totalprecip_in
        var tomorrowCondition = day2.day.condition.text
        var tomorrowRain = day2.day.totalprecip_in
        var tomorrowMin = day2.day.mintemp_c
        var tomorrowMax = day2.day.maxtemp_c

        // Catch JSON error then retry scheduling
        if (typeof todayDate === 'undefined') {
          this.log.error('API JSON not parsed correctly')
          this.log.warn(responseBody)
          this.log.warn('Retrying in 1 minute...')
          setTimeout(() => {
            this._calculateSchedule(function () {})
          }, 60000)
          return
        }

        this.log('Today summary: %s', todayCondition)
        this.log('Today rain (in): %s', todayRain)
        this.log('Tomorrow summary: %s', tomorrowCondition)
        this.log('Tomorrow min temp (°C): %s', tomorrowMin)
        this.log('Tomorrow max temp (°C): %s', tomorrowMax)
        this.log('Tomorrow rain (in): %s', tomorrowRain)

        this.wateringDuration = this.defaultDuration
        // Adjustments to watering duration should be made here:
        if (tomorrowMax > this.highThreshold) {
          this.wateringDuration = this.wateringDuration * this.heatMultiplier
        }

        var totalTime = this.wateringDuration * this.zones
        this.wateringDuration = this.wateringDuration / this.cycles

        var now = new Date()
        var todaySunriseDate = new Date(todayDate + 'T' + todaySunrise)
        var tomorrowSunriseDate = new Date(tomorrowDate + 'T' + tomorrowSunrise)
        var scheduledTime = new Date(todaySunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
        if (scheduledTime.getTime() < now.getTime()) {
          scheduledTime = new Date(tomorrowSunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
        }
        var finishTime = new Date(scheduledTime.getTime() + totalTime * 60000)

        if (!this.restrictedDays.includes(scheduledTime.getDay()) && todayRain < this.rainThreshold && tomorrowRain < this.rainThreshold && tomorrowMin > this.lowThreshold) {
          this.scheduledWateringTime = schedule.scheduleJob(scheduledTime, function () {
            this.log('Starting water cycle (1/%s)', this.cycles)
            this._wateringCycle(1, 1)
          }.bind(this))
          this.log('Each zone will recieve %sx %s minute cycles', this.cycles, this.wateringDuration)
          this.log('Watering starts at: %s (%s)', this._dateExtraction(finishTime, 'time'), this._dateExtraction(finishTime, 'date'))
          this.log('Total watering time: %s minutes (finishes at %s)', totalTime, this._dateExtraction(finishTime, 'time'))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
          this.service.getCharacteristic(Characteristic.Active).updateValue(1)
        } else {
          this.log('No schedule set, will recalculate at %s (%s)', this._dateExtraction(finishTime, 'time'), this._dateExtraction(finishTime, 'date'))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          this.service.getCharacteristic(Characteristic.Active).updateValue(0)
          schedule.scheduleJob(scheduledTime, function () {
            this.log('Calculating schedule...')
            this._calculateSchedule(function () {})
          }.bind(this))
        }
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
          this.log('Starting watering cycle (%s/%s)', nextCycle, this.cycles)
        } else {
          this.log('Watering finished')
          this.log('Calculating schedule...')
          this._calculateSchedule(function () {})
        }
      }
    }, this.wateringDuration * 60000)
  },

  setActive: function (zone, value, callback) {
    var url = this.apiroute + '/' + zone + '/setState/' + value
    this.log('Zone %s | Setting state: %s', zone, url)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Zone %s | Error setting state: %s', zone, error.message)
        callback(error)
      } else {
        this.log('Zone %s | Successfully set state to %s', zone, value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        callback()
      }
    }.bind(this))
  },

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
    this.service.getCharacteristic(Characteristic.Active).updateValue(0)
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
      accessory.getCharacteristic(Characteristic.Active).updateValue(0)
      accessory.getCharacteristic(Characteristic.InUse).updateValue(0)

      accessory
        .getCharacteristic(Characteristic.Active)
        .on('set', this.setActive.bind(this, zone))

      this.valveAccessory[zone] = accessory
      this.service.addLinkedService(accessory)
      services.push(accessory)
    }
    this.log('Initialized %s zones', this.zones)

    if (this.scheduling) {
      this.log('Calculating schedule...')
      this._calculateSchedule(function () {})
    }

    this._getStatus(function () {})

    setInterval(function () {
      this._getStatus(function () {})
    }.bind(this), this.pollInterval * 1000)

    return services
  }

}
