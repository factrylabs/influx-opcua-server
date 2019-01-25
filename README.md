# influx-opcua-server
A simple server for exposing data inside InfluxDB over OPCUA, brought to you by [factry](https://www.factry.io).

## Purpose

This project was built as a proof of concept to get data in InfluxDB (for example the result of some event processing algorithm) back to the automation layer. OPCUA is the de facto protocol to use. 

## How it works / assumptions

This server takes a config file in which you specify which measurements in InfluxDB you want to expose. The application assumes that there is only 1 retention policy in the DB (for now) For each measurement, the last values of each individual series/field combination will be exposed in the OPCUA namespace like this:

```
Objects
  |- Database1
  |   |- Measurement1
  |       |- Tag1=Tag1Value1,Tag2=Tag2Value1
  |       |   |- Field1.last
  |       |   |- Field2.last
  |       |- Tag1=Tag1Value2,Tag2=Tag2Value1
  |           |- Field1.last
  |           |- Field2.last
  |- Database2
      |- Measurement1
         ...
```

## How to run it

> TODO: provide ready-to-run packages for each OS.

This project requires node v8 or highter.

1. Clone it!
2. `npm install`
3. Create a JSON config file (see below)
4. Set the path to this config file in the environment variable `CONFIG_PATH`
5. `node index.js`

## The config file

You can find an example config file in /example_config

### opcua
Some settings for running the OPCUA server:

* **port**: The port to run on.
* **user**: The user for basic auth on the server. When empty, anonymous access is allowed.
* **pass**: The password for basic auth.


### influx


* **protocol**: http or https, defaults to http
* **host**: defaults to localhost
* **port**: defaults to 8086,
* **user**: ..
* **pass**: ..
* **database**: ..

### 

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Credits

* Jeroen Coussement - [@coussej](https://twitter.com/coussej) - [coussej.github.io](http://coussej.github.io) - [factry.io](https://www.factry.io)
* Etienne Rossignon - [@gadz_er](https://twitter.com/gadz_er) - for creating the fantastic [node-opcua](https://github.com/node-opcua/node-opcua) library.


## License

MIT
