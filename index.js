var Service, Characteristic
const request = require('request')
const packageJson = require('./package.json')

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-web-sprinkler', 'WebSprinkler', WebSprinkler)
}

function WebSprinkler (log, config) {
  this.log = log

  this.name = config.name
  this.apiroute = config.apiroute
  this.zones = config.zones || 3
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

  this.service = new Service.IrrigationSystem(this.name)
}

WebSprinkler.prototype = {

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

  getServices: function () {
    this.service.getCharacteristic(Characteristic.ProgramMode).updateValue(1)
    // this.service.getCharacteristic(Characteristic.Active).updateValue(0)
    // this.service.getCharacteristic(Characteristic.InUse).updateValue(0)

    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    var services = [this.informationService, this.service]
    var index
    var count = this.zones + 1
    for (index = 1; index < count; index++) {
      var accessory = new Service.Valve('Zone', index)
      accessory
        .setCharacteristic(Characteristic.ServiceLabelIndex, index)
        .setCharacteristic(Characteristic.ValveType, 1)
      accessory.getCharacteristic(Characteristic.Active).updateValue(0)
      accessory.getCharacteristic(Characteristic.InUse).updateValue(0)
      accessory
        .getCharacteristic(Characteristic.Active)
        // .on('set', this.setActive).bind(this)

        // Function below does not handle `index` as desired
        .on('set', (value, callback) => {
          this.setActive(value, callback, index)
        })

      this.valveAccessory[index] = accessory
      this.service.addLinkedService(accessory)
      services.push(accessory)
      this.log('Initialized Zone %s', index)
    }

    return services
  }

}
