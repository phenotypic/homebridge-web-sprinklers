let Service, Characteristic
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

  this.lowThreshold = config.lowThreshold || 10
  this.highThreshold = config.highThreshold || 20
  this.rainThreshold = config.rainThreshold || 2.3

  this.defaultDuration = config.defaultDuration || 20
  this.maxDuration = config.maxDuration || 30

  this.cycles = config.cycles || 2

  this.zonePercentages = config.zonePercentages || new Array(this.zones).fill(100)

  this.valveAccessory = []
  this.zoneDuration = []

  this.manufacturer = config.manufacturer || packageJson.author
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
      const baseURL = 'http://' + request.headers.host + '/'
      const url = new URL(request.url, baseURL)
      if (this.requestArray.includes(url.pathname.substr(1))) {
        try {
          this.log.debug('Handling request')
          response.end('Handling request')
          this._httpHandler(url.searchParams.get('zone'), url.pathname.substr(1), url.searchParams.get('value'))
        } catch (e) {
          this.log.warn('Error parsing request: %s', e.message)
        }
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
    const url = this.apiroute + '/status'
    this.log.debug('Getting status: %s', url)

    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting status: %s', error.message)
        this.service.getCharacteristic(Characteristic.Active).updateValue(new Error('Polling failed'))
        callback(error)
      } else {
        this.service.getCharacteristic(Characteristic.Active).updateValue(1)
        this.log.debug('Device response: %s', responseBody)
        try {
          const json = JSON.parse(responseBody)

          for (let zone = 1; zone <= this.zones; zone++) {
            const value = json[zone - 1].state
            this.log.debug('Zone %s | Updated state to: %s', zone, value)
            this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
            this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
          }
          callback()
        } catch (e) {
          this.log.warn('Error parsing status: %s', e.message)
        }
      }
    }.bind(this))
  },

  _httpHandler: function (zone, characteristic, value) {
    switch (characteristic) {
      case 'state': {
        this.valveAccessory[zone].getCharacteristic(Characteristic.Active).updateValue(value)
        this.valveAccessory[zone].getCharacteristic(Characteristic.InUse).updateValue(value)
        this.log('Zone %s | Updated %s to: %s', zone, characteristic, value)
        break
      }
      default: {
        this.log.warn('Zone %s | Unknown characteristic "%s" with value "%s"', zone, characteristic, value)
      }
    }
  },

  _calculateSchedule: function (callback) {
    const url = 'https://api.openweathermap.org/data/2.5/onecall?lat=' + this.latitude + '&lon=' + this.longitude + '&exclude=current,hourly&units=metric&appid=' + this.key
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
          const json = JSON.parse(responseBody)
        } catch (error) {
          setTimeout(() => {
            this._calculateSchedule(function () {})
          }, 60000)
          return this.log.error('Error parsing weather data: %s', error)
        }

        const today = {}
        today.summary = json.daily[0].weather[0].description
        today.sunrise = new Date(json.daily[0].sunrise * 1000)
        today.min = json.daily[0].temp.min
        today.max = json.daily[0].temp.max
        today.rain = ('rain' in json.daily[0]) ? json.daily[0].rain : 0
        today.clouds = json.daily[0].clouds

        const tomorrow = {}
        tomorrow.summary = json.daily[1].weather[0].description
        tomorrow.sunrise = new Date(json.daily[1].sunrise * 1000)
        tomorrow.min = json.daily[1].temp.min
        tomorrow.max = json.daily[1].temp.max
        tomorrow.rain = ('rain' in json.daily[1]) ? json.daily[1].rain : 0
        tomorrow.clouds = json.daily[1].clouds

        this.log('----------------------------------------------')
        this.log('Today summary: %s', today.summary)
        this.log('Today sunrise: %s', today.sunrise.toLocaleString())
        this.log('Today min temp: %s °C', today.min)
        this.log('Today max temp: %s °C', today.max)
        this.log('Today rain: %s mm', today.rain)
        this.log('Today cloud cover: %s %', today.clouds)
        this.log('----------------------------------------------')
        this.log('Tomorrow summary: %s', tomorrow.summary)
        this.log('Tomorrow sunrise: %s', tomorrow.sunrise.toLocaleString())
        this.log('Tomorrow min temp: %s °C', tomorrow.min)
        this.log('Tomorrow max temp: %s °C', tomorrow.max)
        this.log('Tomorrow rain: %s mm', tomorrow.rain)
        this.log('Tomorrow cloud cover: %s %', tomorrow.clouds)
        this.log('----------------------------------------------')

        let maximumTotal
        if (this.disableAdaptiveWatering) {
          maximumTotal = this.zones * this.defaultDuration
        } else {
          maximumTotal = this.zones * this.maxDuration
        }

        const earliestToday = new Date(today.sunrise.getTime() - (maximumTotal + this.sunriseOffset) * 60000)
        let waterDay
        if (earliestToday.getTime() > Date.now()) {
          waterDay = today
        } else {
          waterDay = tomorrow
        }

        if (!this.restrictedDays.includes(waterDay.sunrise.getDay()) && !this.restrictedMonths.includes(waterDay.sunrise.getMonth()) && today.rain < this.rainThreshold && tomorrow.rain < this.rainThreshold && waterDay.min > this.lowThreshold && waterDay.max > this.highThreshold) {
          let zoneMaxDuration = this.defaultDuration
          if (!this.disableAdaptiveWatering) {
            const highDiff = waterDay.max - this.highThreshold
            const lowDiff = this.highThreshold - waterDay.min
            const cloudPercentage = 100 - (waterDay.clouds / 3)
            zoneMaxDuration = (((this.defaultDuration + (highDiff - lowDiff)) / 100) * cloudPercentage) - waterDay.rain
            if (zoneMaxDuration > this.maxDuration) {
              zoneMaxDuration = this.maxDuration
            }
          }

          for (let zone = 1; zone <= this.zones; zone++) {
            this.zoneDuration[zone] = ((zoneMaxDuration / this.cycles) / 100) * this.zonePercentages[zone - 1]
          }

          const totalTime = this.zoneDuration.reduce((a, b) => a + b, 0) * this.cycles

          const startTime = new Date(waterDay.sunrise.getTime() - (totalTime + this.sunriseOffset) * 60000)
          const finishTime = new Date(startTime.getTime() + totalTime * 60000)

          this.log('Watering starts: %s', startTime.toLocaleString())
          this.log('Watering finishes: %s', finishTime.toLocaleString())
          this.log('Total watering time: %s minutes', Math.round(totalTime))
          this.log('Zone max duration: %s minutes', Math.round(zoneMaxDuration))
          this.log('----------------------------------------------')

          for (let zone = 1; zone <= this.zones; zone++) {
            this.log('Zone %s | %sx %s minute cycles', zone, this.cycles, Math.round(this.zoneDuration[zone]))
          }

          schedule.scheduleJob(startTime, function () {
            this.log('Starting water cycle 1/%s', this.cycles)
            this._wateringCycle(1, 1)
          }.bind(this))
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
        } else {
          this.log('No schedule set, recalculation: %s', waterDay.sunrise.toLocaleString())
          this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(0)
          schedule.scheduleJob(waterDay.sunrise, function () {
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
      const nextZone = zone + 1
      if (nextZone <= this.zones) {
        this._wateringCycle(nextZone, cycle)
      } else {
        const nextCycle = cycle + 1
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
    const url = this.apiroute + '/setState?zone=' + zone + '&value=' + value
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

    const services = [this.informationService, this.service]
    for (let zone = 1; zone <= this.zones; zone++) {
      const accessory = new Service.Valve('Zone', zone)
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
