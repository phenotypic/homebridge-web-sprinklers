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

  setActive: function (value, callback) {
    var url = this.apiroute + '/setState/' + value
    // Would like to use `var url = this.apiroute + zone + '/setState/' + value` but can't tell which zone called the function
    this.log('Setting state: %s', url)

    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error setting state: %s', error.message)
        callback(error)
      } else {
        this.log('Successfully set state to %s', value)
        // Would like to add .getCharacteristic(Characteristic.InUse).updateValue(1)` here but can't tell which zone called the function
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

    // Section below is very bulky - each new zone requires a block of code and needs to be added to `return`
    this.valve1 = new Service.Valve('Zone', 1)
    this.valve1
      .setCharacteristic(Characteristic.ServiceLabelIndex, 1)
      .setCharacteristic(Characteristic.ValveType, 1)
    this.valve1.getCharacteristic(Characteristic.Active).updateValue(0)
    this.valve1.getCharacteristic(Characteristic.InUse).updateValue(0)
    this.valve1
      .getCharacteristic(Characteristic.Active)
      .on('set', this.setActive.bind(this))

    this.valve2 = new Service.Valve('Zone', 2)
    this.valve2
      .setCharacteristic(Characteristic.ServiceLabelIndex, 2)
      .setCharacteristic(Characteristic.ValveType, 1)
    this.valve2.getCharacteristic(Characteristic.Active).updateValue(0)
    this.valve2.getCharacteristic(Characteristic.InUse).updateValue(0)
    this.valve2
      .getCharacteristic(Characteristic.Active)
      .on('set', this.setActive.bind(this))

    this.valve3 = new Service.Valve('Zone', 3)
    this.valve3
      .setCharacteristic(Characteristic.ServiceLabelIndex, 3)
      .setCharacteristic(Characteristic.ValveType, 1)
    this.valve3.getCharacteristic(Characteristic.Active).updateValue(0)
    this.valve3.getCharacteristic(Characteristic.InUse).updateValue(0)
    this.valve3
      .getCharacteristic(Characteristic.Active)
      .on('set', this.setActive.bind(this))

    this.service.addLinkedService(this.valve1)
    this.service.addLinkedService(this.valve2)
    this.service.addLinkedService(this.valve3)

    return [this.informationService, this.service, this.valve1, this.valve2, this.valve3]
  }

}
