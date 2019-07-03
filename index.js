var Service, Characteristic
const packageJson = require('./package.json')
const request = require('request')
const schedule = require('node-schedule')

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
  this.valveAccessory = []

  this.town = config.town
  this.country = config.country
  this.key = config.key

  this.defaultTime = config.defaultTime || 20
  this.rainThreshold = config.rainThreshold || 0
  this.sunriseOffset = config.sunriseOffset || 60
  this.frostTemperature = config.frostTemperature || 10
  this.highTemperature = config.highTemperature || 20
  this.coldPercentage = config.coldPercentage || 50
  this.passes = config.passes || 2

  this.wateringTime = 10
  this.wateringSchedule = null

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

  setActive: function (value, callback, zone) {
    var url = this.apiroute + '/' + zone + '/setState/' + value
    this.log('Zone %s | Setting state: %s', zone, url)

    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Zone %s | Error setting state: %s', zone, error.message)
        callback(error)
      } else {
        this.log('Zone %s | Successfully set state to %s', zone, value)
        // `1` should be replaced with `zone`
        this.valveAccessory[1].getCharacteristic(Characteristic.InUse).updateValue(value)
        callback()
      }
    }.bind(this))
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
        var todayDate = json.forecast.forecastday[0].date
        var todayMin = json.forecast.forecastday[0].day.mintemp_c
        var todayMax = json.forecast.forecastday[0].day.maxtemp_c
        var todayRain = json.forecast.forecastday[0].day.totalprecip_in
        var todayCondition = json.forecast.forecastday[0].day.condition.text
        var todaySunrise = json.forecast.forecastday[0].astro.sunrise.replace(' AM', '')
        var tomorrowDate = json.forecast.forecastday[1].date
        var tomorrowRain = json.forecast.forecastday[1].day.totalprecip_in
        var tomorrowCondition = json.forecast.forecastday[1].day.condition.text
        var tomorrowSunrise = json.forecast.forecastday[1].astro.sunrise.replace(' AM', '')
        this.log('Today: %s', todayCondition)
        this.log('Today min temp: %s', todayMin)
        this.log('Today max temp: %s', todayMax)
        this.log('Today rain (in): %s', todayRain)
        this.log('Tomorrow: %s', tomorrowCondition)
        this.log('Tomorrow rain (in): %s', tomorrowRain)

        var todaySunriseDate = new Date(todayDate + 'T' + todaySunrise)
        var tomorrowSunriseDate = new Date(tomorrowDate + 'T' + tomorrowSunrise)

        if (todayRain <= this.rainThreshold && tomorrowRain <= this.rainThreshold && todayMin > this.frostTemperature) {
          this.wateringTime = this.defaultTime
          if (todayMax < this.highTemperature) {
            this.log('Max temperature is less than %s°C so watering time reduced by %s%', this.highTemperature, this.coldPercentage)
            this.wateringTime = this.wateringTime / this.coldPercentage
          }
          var totalTime = this.wateringTime * this.zones
          this.wateringTime = this.wateringTime / this.passes
          this.log('Will water each zone for %s minutes (%s passes)', this.wateringTime, this.passes)

          var now = new Date()
          var scheduledTime = new Date(todaySunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
          if (scheduledTime.getTime() < now.getTime()) {
            scheduledTime = new Date(tomorrowSunriseDate.getTime() - (totalTime + this.sunriseOffset) * 60000)
          }
          var finishTime = new Date(scheduledTime.getTime() + totalTime * 60000)

          this.wateringSchedule = schedule.scheduleJob(scheduledTime, function () {
            this._wateringCycle()
          }.bind(this))
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

  _wateringCycle: function () {
    // Repeat the following `this.passes` times: Increment through `this.zones`, watering each for `this.wateringTime` minutes
    this.log('Activating zone %s', i)
    setTimeout(() => {
      this.log('Deactivating zone %s', i)
    }, 5 * 1000)
  },

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
    this.service.getCharacteristic(Characteristic.Active).updateValue(0) // `1` is scheduled, `0` no schedule (for the day)
    this.service.getCharacteristic(Characteristic.InUse).updateValue(0)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    var services = [this.informationService, this.service]
    var count = this.zones + 1
    for (var index = 1; index < count; index++) {
      var accessory = new Service.Valve('Zone', index)
      accessory
        .setCharacteristic(Characteristic.ServiceLabelIndex, index)
        .setCharacteristic(Characteristic.ValveType, 1)
      accessory.getCharacteristic(Characteristic.Active).updateValue(0)
      accessory.getCharacteristic(Characteristic.InUse).updateValue(0)

      // Function below should have the ability to notify which zone is calling them
      accessory
        .getCharacteristic(Characteristic.Active)
        .on('set', this.setActive.bind(this))

      this.valveAccessory[index] = accessory
      this.service.addLinkedService(accessory)
      services.push(accessory)
    }
    this.log('Initialised %s zones', this.zones)

    this._calculateSchedule(function () {})

    return services
  }

}
