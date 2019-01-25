const Ajv = require('ajv')
const fs = require('fs')
const InfluxDB = require('./influxdb.js')
const OPCUAServer = require('./opcua.js')

class InfluxOPCUAServer {
  async run () {
    console.log(`Influx OPCUA Server is brought to you by Factry (www.factry.io)`)
    console.log(`You are currently running v${require('./../package.json').version}`)

    // load config file and validate it agains the schema

    let configPath = process.env.CONFIG_PATH || './config.json'
    let configSchema = require('./schema/config.json')
    let config = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    let configValidator = (new Ajv()).compile(configSchema)

    if (!configValidator(config)) {
      throw new Error('Invalid config file: ' + configValidator.errors[0].dataPath + ' ' + configValidator.errors[0].message)
    }

    // load influx and get all series from the measurements specified in the
    // config file.

    const influxDB = new InfluxDB(config.influx)

    await influxDB.initialize()

    let series = []
    for (let m of config.measurementsToExpose) {
      let db = m.database || config.influx.database

      let s = await influxDB.getSeriesForMeasurement(db, m.name)
      series.push(...s)
    }

    // load OPCUA server and add all the influx series to it.
    let server = new OPCUAServer(influxDB, config.opcua)
    await server.initialize()

    for (let s of series) {
      server.addSeries(s)
    }

    // Run, Forest, Run!
    await server.start()
    console.log(`OPCUA server running on port ${server.port}`)
  }
}

module.exports = InfluxOPCUAServer
