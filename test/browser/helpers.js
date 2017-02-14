var waatest = require('waatest')
  , Pd = require('../index')

exports.expectSamples = function(onStarted, expected, done) {
  waatest.utils.expectSamples(function(context) {
    var channelCount = expected.length
      , audio = new TestAudio(channelCount, context)
    Pd.start({audio: audio})
    onStarted()
  }, expected, function(err) {
    Pd.stop()
    done(err)
  })
}

exports.renderSamples = function(channelCount, frameCount, onStarted, done) {
  waatest.utils.renderSamples(channelCount, frameCount, function(context) {
    var audio = new TestAudio(channelCount, context)
    Pd.start({ audio: audio })
    onStarted()
  }, function(err, block) {
    Pd.stop()
    done(err, block)
  })
}

// Audio engine for testing
var TestAudio = function(channelCount, context) {
  var ch
  Object.defineProperty(this, 'time', {
    get: function() { return context.currentTime * 1000 }
  })
  this.context = context
  this.sampleRate = context.sampleRate
  this._channelMerger = this.context.createChannelMerger(channelCount)
  this._channelMerger.connect(this.context.destination)
  this.channels = []
  for (ch = 0; ch < channelCount; ch++) {
    this.channels.push(this.context.createGain())
    this.channels[ch].connect(this._channelMerger, 0, ch)
  }
}
TestAudio.prototype.start = function() {}
TestAudio.prototype.stop = function() {}