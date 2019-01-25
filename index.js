const InfluxOPCUAServer = require('./src')

;(async () => {
  let server = new InfluxOPCUAServer()
  try {
    await server.run()
  } catch (e) {
    console.error(`could not run server: ${e.message}`)
  }
})()
