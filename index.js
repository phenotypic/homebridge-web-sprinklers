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

  this.listener = config.listener || false
  this.port = config.port || 2000
  this.requestArray = ['state']

  this.town = config.town
  this.country = config.country
  this.key = config.key

  this.defaultTime = config.defaultTime || 20
  this.passes = config.passes || 2
  this.rainThreshold = config.rainThreshold || 0.05
  this.sunriseOffset = config.sunriseOffset || 60
  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20
  this.reductionPercentage = config.reductionPercentage || 50

  this.wateringTime = 10
  this.wateringSchedule = null
  this.valveAccessory = []
  this.timeoutArray = []

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

  _calculateSchedule: function (callback) {
    var url = 'http://api.apixu.com/v1/forecast.json?key=' + this.key + '&q=' + this.town + ',' + this.country + '&days=2'
    this.log('Retrieving weather data for %s - %s', this.town, this.country)
    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting weather data: %s', error)
        callback(error)
      } else {
        var json = JSON.parse(responseBody)
        var day1 = json.forecast.forecastday[0]
        var day2 = json.forecast.forecastday[1]
        var todayDate = day1.date
        var todayMin = day1.day.mintemp_c
        var todayMax = day1.day.maxtemp_c
        var todayRain = day1.day.totalprecip_in
        var todayCondition = day1.day.condition.text
        var todaySunrise = day1.astro.sunrise.substring(0, 5)
        var tomorrowDate = day2.date
        var tomorrowRain = day2.day.totalprecip_in
        var tomorrowCondition = day2.day.condition.text
        var tomorrowSunrise = day2.astro.sunrise.substring(0, 5)
        this.log('Today summary: %s', todayCondition)
        this.log('Today min temp (°C): %s', todayMin)
        this.log('Today max temp (°C): %s', todayMax)
        this.log('Today rain (in): %s', todayRain)
        this.log('Tomorrow summary: %s', tomorrowCondition)
        this.log('Tomorrow rain (in): %s', tomorrowRain)

        this.wateringTime = this.defaultTime
        if (todayMax < this.highThreshold) {
          this.wateringTime = (this.reductionPercentage / 100) * this.wateringTime
        }
        var totalTime = this.wateringTime * this.zones
        this.wateringTime = this.wateringTime / this.passes

        if (todayRain <= this.rainThreshold && tomorrowRain <= this.rainThreshold && todayMin > this.lowThreshold) {
          var now = new Date()
          var todaySunriseDate = new Date(todayDate + 'T' + todaySunrise)
          var tomorrowSunriseDate = new Date(tomorrowDate + 'T' + tomorrowSunrise)

          var scheduledTime = new Date(todaySunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
          if (scheduledTime.getTime() < now.getTime()) {
            scheduledTime = new Date(tomorrowSunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
          }
          var finishTime = new Date(scheduledTime.getTime() + totalTime * 60000)

          this.wateringSchedule = schedule.scheduleJob(scheduledTime, function () {
            this.log('Starting water cycle')
            this._wateringCycle(1, 1)
          }.bind(this))
          // Cancel schedule with `this.wateringSchedule.cancel()`
          this.log('Will water each zone for %s minutes (%s passes)', this.wateringTime, this.passes)
          this.log('Watering scheduled for: %s', scheduledTime.getDate() + '-' + (scheduledTime.getMonth() + 1) + '-' + scheduledTime.getFullYear() + ' ' + scheduledTime.getHours() + ':' + scheduledTime.getMinutes() + ':' + scheduledTime.getSeconds())
          this.log('Total watering time: %s minutes (finishes at %s)', totalTime, finishTime.getHours() + ':' + finishTime.getMinutes() + ':' + finishTime.getSeconds())
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
          this.service.getCharacteristic(Characteristic.Active).updateValue(1)
        } else {
          this.log('No schedule set: conditions not suitable for watering')
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          this.service.getCharacteristic(Characteristic.Active).updateValue(0)
        }
        callback()
      }
    }.bind(this))
  },

  _wateringCycle: function (zone, pass) {
    this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 1)
    setTimeout(() => {
      var nextZone = zone + 1
      if (nextZone <= this.zones) {
        this._wateringCycle(nextZone, pass)
      } else {
        var nextPass = pass + 1
        if (nextPass <= this.passes) {
          this._wateringCycle(1, nextPass)
          this.log('Starting pass %s', nextPass)
        } else {
          this.log('Watering cycle finished')
          this.log('Calculating schedule for tomorrow...')
          this._calculateSchedule(function () {})
        }
      }
    }, this.wateringTime * 60000)
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
        if (value === 1) {
          this.timeoutArray[zone] = setTimeout(() => {
            this.valveAccessory[zone].setCharacteristic(Characteristic.Active, 0)
          }, this.wateringTime * 60000)
          this.log(this.wateringTime)
        } else {
          clearTimeout(this.timeoutArray[zone])
        }
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
    var count = this.zones + 1
    for (var zone = 1; zone < count; zone++) {
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
    this.log('Initialised %s zones', this.zones)

    this._calculateSchedule(function () {})

    return services
  }

}
