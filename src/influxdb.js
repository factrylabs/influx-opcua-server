const Influx = require('influx')

class InfluxDB {
  constructor (options) {
    this.influx = new Influx.InfluxDB({
      protocol: options.protocol || 'http',
      host: options.host || 'localhost',
      port: options.port || 8086,
      username: options.user,
      password: options.pass,
      database: options.database
    })
  }

  async initialize () {
    // check the connection
    let ping = (await this.influx.ping(3000))[0]
    if (!ping.online) {
      throw new Error(`Influx not available on ${ping.url.href}!`)
    }
    console.log(`Connected to influx ${ping.version} on ${ping.url.href}`)

    // get the list of databases
    this.availableDatabases = await this.influx.getDatabaseNames()
  }

  /**
   * getSeriesForMeasurement gets all known series from the database for a
   * specific measurement.
   */
  async getSeriesForMeasurement (database, measurement) {
    let rawSeries = await this.influx.getSeries({ database, measurement })
    if (rawSeries.length === 0) throw new Error(`No series found for measurement ${measurement} in database ${database}`)

    let tagsets = []
    for (let rs of rawSeries) {
      tagsets.push(_extractTagsFromSeriesLineProtocol(rs))
    }

    let rawFields = await this.influx.query(`SHOW FIELD KEYS ON ${database} FROM ${measurement}`)
    let fields = rawFields.map(f => { return { key: f.fieldKey, datatype: f.fieldType } })

    let series = []
    for (let tags of tagsets) {
      series.push(new InfluxSeries({ database, measurement, tags, fields }))
    }

    return series
  }

  /**
   * getLastValueForField gets the last known value from the database for a
   * specific field from a series.
   */
  async getLastValueForField (series, field) {
    let q = `SELECT last(${field}) AS value FROM ${series.measurement} WHERE ${series.getWhereClause()} AND time <= now()`
    let res = await this.influx.query(q, { database: series.database })

    return res[0]
  }

  /**
   * getLastMeanValueForField gets the mean value from the database for a
   * specific field from a series from between now and the specified period ago.
   */
  async getLastMeanValueForField (series, field, period) {
    let q = `SELECT mean(${field}) AS value FROM ${series.measurement} 
             WHERE time < now() AND time > now() - ${period} AND ${series.getWhereClause()}`
    let res = await this.influx.query(q, { database: series.database })

    return res[0]
  }
}

/**
 * InfluxSeries represemts a single series from influxdb
 */
class InfluxSeries {
  /**
   * build a new InfluxSeries
   */
  constructor (opts) {
    this.database = opts.database
    this.measurement = opts.measurement
    this.tags = opts.tags
    this.fields = opts.fields
  }

  /**
   * getWhereClause builds a where clause from the tags, to use in queries so
   * that only data from this specific series is used.
   */
  getWhereClause () {
    return this.tags.map(t => `"` + t.key + `" = '` + t.value + `'`).join(' AND ')
  }

  /**
   * getTagSet returns a string representation of the tag set, similar to line
   * protocol but without escaping.
   */
  getTagSet () {
    return this.tags.map(t => t.key + `=` + t.value).join(',')
  }
}

/**
 * _extractTagsFromSeriesLineProtocol converts a series line protocol return by influx's
 * getSeries to key value pairs
 *  @param {string} lp: a series in line protocol as return by SHOW SERIES, in the form of "measurement,t1=v1,t2=v2"
 */
function _extractTagsFromSeriesLineProtocol (lp) {
  // split on unescaped comma's and unescaped '='s -> ['measurement', 't1', 'v1', 't2', 'v2']
  let raw = lp.split(/(?<!\\),|(?<!\\)=/)
  // remove measurement name -> ['t1', 'v1', 't2', 'v2']
  raw.shift()

  // build the taglist
  let tags = []
  for (let i = 0; i < raw.length; i += 2) {
    tags.push({
      key: _unescapeLineProtocolString(raw[i]),
      value: _unescapeLineProtocolString(raw[i + 1])
    })
  }
  return tags
}

/**
 * _unescapeLineProtocolString unescapes a string originating from a query that
 * returns line protocol
 * @param {string} lp: the line protocol key or value
 */
function _unescapeLineProtocolString (lp) {
  let chars = lp.split('')
  let result = ''
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === '\\') {
      result += chars[i + 1]
      i += 1
    } else {
      result += chars[i]
    }
  }
  return result
}

module.exports = InfluxDB
