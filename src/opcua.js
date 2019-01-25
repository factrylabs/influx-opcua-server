const Promise = require('bluebird')
const opcua = require('node-opcua')

/**
 * OPCUAServer bundles the logic to set up an OPCUA server using node-opcua and
 * to add series coming from influxDB to it.
 */
class OPCUAServer {
  constructor (influxDB, opts) {
    this.influxDB = influxDB
    this.port = opts.port || 4334
    this.user = opts.user
    this.pass = opts.pass
    this.folders = {}
  }

  /**
   * initialize creates and initializes the UA server.
   */
  async initialize () {
    console.log(`Building OPCUA Server space.`)

    // set the server options.
    let uaServerOptions = {
      port: this.port,
      resourcePath: 'UA/InfluxOPCUAServer',
      serverInfo: {
        applicationName: 'Influx OPCUA Server',
        applicationUri: 'urn:Influx-OPCUA-Server',
        productUri: 'http://www.factry.io'
      }
    }

    // if username is set in the config, enable basic auth and disallow anonymous
    let [user, pass] = [this.user, this.pass]
    if (user) {
      console.log(`UA basic auth is set.`)
      uaServerOptions.userManager = {
        isValidUser: (u, p) => {
          if (u === user && p === pass) return true
          console.warn(`Invalid login attempt from ${u}`)
          return false
        }
      }
      uaServerOptions.allowAnonymous = false
    }

    this.uaServer = new opcua.OPCUAServer(uaServerOptions)
    Promise.promisifyAll(this.uaServer) // node OPCUA has no promises on server level yet.

    await this.uaServer.initializeAsync()
    this.addressSpace = this.uaServer.engine.addressSpace
    this.namespace = this.addressSpace.getOwnNamespace()
  }

  addSeries (series) {
    // check if folder already exists for database
    if (!this.folders[series.database]) {
      this.folders[series.database] = {
        uaFolder: this.namespace.addFolder(
          this.addressSpace.rootFolder.objects, { browseName: series.database }
        ),
        subfolders: {}
      }
    }
    let folder = this.folders[series.database]

    // add folder for measurement
    if (!folder.subfolders[series.measurement]) {
      folder.subfolders[series.measurement] = {
        uaFolder: this.namespace.addFolder(
          folder.uaFolder, { browseName: series.measurement }
        ),
        devices: {}
      }
    }
    let subfolder = folder.subfolders[series.measurement]

    // add device for series
    let tagset = series.getTagSet()
    if (!subfolder.devices[tagset]) {
      subfolder.devices[tagset] = this.namespace.addObject({
        organizedBy: subfolder.uaFolder,
        browseName: tagset
      })
    }
    let device = subfolder.devices[tagset]

    // add all fields of the series as a seperate node
    for (let f of series.fields) {
      let dataType = { boolean: 'Boolean', float: 'Double', string: 'String', integer: 'Integer' }[f.datatype]

      let influx = this.influxDB
      this.namespace.addVariable({
        componentOf: device,
        browseName: f.key + '.last',
        nodeId: 's=' + series.database + '.' + series.measurement + '(' + tagset + ').' + f.key + '.last',
        dataType,
        value: {
          refreshFunc: function (callback) {
            console.log(` -> request for last value of field '${f.key}' of measurement '${series.measurement}' on db '${series.database}'`)
            influx.getLastValueForField(series, f.key)
              .then(result => {
                let value = new opcua.DataValue({
                  value: { dataType: opcua.DataType[dataType], value: result.value },
                  sourceTimestamp: result.time
                })
                callback(null, value)
              })
              .catch(err => {
                console.error(err)
              })
          }
        }
      })
    }
  }

  /**
   * start starts the server...
   */
  async start () {
    await this.uaServer.startAsync()
  }
}

module.exports = OPCUAServer
