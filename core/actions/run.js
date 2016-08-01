var tb = require('timebucket')

module.exports = function container (get, set, clear) {
  var c = get('config')
  var series = get('motley:vendor.run-series')
  var mark_complete = get('utils.mark_complete')
  return function run () {
    var rs = get('run_state')
    var runner = get('runner')
    var max_time = new Date().getTime()
    var currently_idle = false
    ;(function getNext () {
      rs.tick = tb(c.brain_speed).toString()
      if (rs.tick === rs.last_tick) {
        return setTimeout(getNext, c.brain_speed_ms / 2)
      }
      get('logger').info('run', 'tick'.grey, rs.tick.grey)
      rs.last_tick = rs.tick
      var params = {
        query: {
          app_name: get('app_name'),
          complete: true,
          size: c.brain_speed,
          time: {
            $gt: max_time
          }
        },
        sort: {
          time: 1
        }
      }
      get('ticks').select(params, function (err, ticks) {
        if (err) throw err
        if (ticks.length) {
          get('logger').info('run', 'processing'.grey, ticks.length, 'ticks'.grey)
          currently_idle = false
          var tasks = ticks.map(function (tick) {
            max_time = Math.max(tick.time, max_time)
            return function task (done) {
              runner(tick, done)
            }
          })
          series(tasks, function (err) {
            if (err) {
              get('logger').error('run err', err)
            }
            setImmediate(getNext)
          })
        }
        else {
          mark_complete(max_time, c.brain_speed, function (err) {
            if (err) throw err
            if (!currently_idle) {
              get('logger').info('run', 'idle'.grey)
              currently_idle = true
            }
            setTimeout(getNext, c.brain_speed_ms / 2)
          })
        }
      })
    })()
  }
}