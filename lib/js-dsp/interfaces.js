/*
 * Copyright (c) 2011-2017 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
 
var _ = require('underscore')
  , getUserMedia = require('getusermedia')
  , pdGlob = require('../global')


var Audio = exports.Audio = function(opts) {
  this.channelCount = 2
  this.blockSize = opts.blockSize || 4096
  this.sampleRate = opts.sampleRate
  if (opts.audioContext)
    this.setContext(opts.audioContext)
  this.stream = null

  this.frame = 0
  Object.defineProperty(this, 'time', {
    get: function() { return this.frame / this.sampleRate * 1000 },
  })

  this._endPoints = []
  this._buffers = []
  for (ch = 0; ch < this.channelCount; ch++)
    this._buffers.push(new Float32Array(this.blockSize))
}

Audio.prototype.start = function() {}
Audio.prototype.stop = function() {}

Audio.prototype.registerEndPoint = function(endPoint) {
  this._endPoints.push(endPoint)
}

Audio.prototype.pushBuffer = function(ch, buffer) {
  this._buffers[ch] = buffer
}

Audio.prototype.tick = function() {
  var blockEnd = this.frame + this.blockSize
  var endPointsCount = this._endPoints.length
  var offset = 0
  var nextFrame, subBlockSize, i
  while (this.frame !== blockEnd) {
    nextFrame = pdGlob.clock.tick(blockEnd)

    subBlockSize = nextFrame - this.frame
    if (subBlockSize) {
      for (i = 0; i < endPointsCount; i++) {
        this._endPoints[i].tick(subBlockSize, offset)
      }
    }
    offset += subBlockSize
    this.frame = nextFrame
  }
}

Audio.prototype.setContext = function(context) {
  var self = this
    , ch
  this.context = context
  this.sampleRate = this.context.sampleRate

  this._scriptProcessor = this.context.createScriptProcessor(this.blockSize, 
    this.channelCount, this.channelCount)

  this._scriptProcessor.onaudioprocess = function(event) {
    self.frame += self.blockSize
    for (ch = 0; ch < self.channelCount; ch++)
      event.outputBuffer.getChannelData(ch).set(self._buffers[ch])
    
    setTimeout(function() {
      self.tick()
    }, 0)
  }
  this._scriptProcessor.connect(this.context.destination)
}

Audio.prototype.decode = function(arrayBuffer, done) {
  this.context.decodeAudioData(arrayBuffer, 
    function(audioBuffer) {
      var chArrays = [], ch
      for (ch = 0; ch < audioBuffer.numberOfChannels; ch++)
        chArrays.push(audioBuffer.getChannelData(ch))
      done(null, chArrays)
    },
    function(err) {
      done(new Error('error decoding ' + err))
    }
  )
}

Audio.prototype.getUserMedia = function(done) {
  var self = this
  if (this.stream) done(null, this.stream)
  else {
    getUserMedia({
      audio: {
        mandatory: {
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googTypingNoiseDetection: false
        }
      }
    }, function (err, stream) {
      self.stream = stream
      done(err, stream)
    })
  }
}


// Scheduler to handle timing
var Clock = exports.Clock = function() {
  this._events = []
} 

Clock.prototype.schedule = function(func, time, repetition) {
  return this._insertEvent({ 
    func: func, 
    frame: time * pdGlob.audio.sampleRate / 1000, 
    repetition: repetition ? repetition * pdGlob.audio.sampleRate / 1000 : null
  })
}

Clock.prototype.unschedule = function(event) {
  this._events = _.without(this._events, event)
}

Clock.prototype.tick = function(blockEnd) {
  var frame = pdGlob.audio.frame

  // Remove outdated events
  while (this._events.length && this._events[0].frame < frame) {
    this._events.shift()
    console.error('outdated event discarded')
  }

  // Execute events that are scheduled for the current frame
  while (this._events.length && Math.floor(this._events[0].frame) === frame) {
    var event = this._events[0]
    event.timeTag = event.frame / pdGlob.audio.sampleRate * 1000
    event.func(event)
    if (event.repetition && this._events.indexOf(event) !== -1) {
      event.frame = event.frame + event.repetition
      this._insertEvent(event)
    } else {
      this._events = _.without(this._events, event)
    }
  }

  if (this._events.length)
    return Math.floor(Math.min(this._events[0].frame, blockEnd))
  else
    return blockEnd
}

Clock.prototype._insertEvent = function(event) {
  var ind = _.sortedIndex(this._events, event, 'frame')
  this._events.splice(ind, 0, event)
  return event
}


var Midi = exports.Midi = function() {
  this._midiInput = null
  this._callback = function() {}
}

Midi.prototype.onMessage = function(callback) {
  this._callback = callback
}

Midi.prototype.getMidiInput = function() {
  return this._midiInput
}

// Associate a MIDIInput object per the Web MIDI spec
// See <https://www.w3.org/TR/webmidi/#midiinput-interface>
// Set to `null` to deactivate midi input
Midi.prototype.setMidiInput = function(midiInput) {
  if (midiInput === this._midiInput)
    return
  if (this._midiInput)
    this._midiInput.removeEventListener('midimessage', this._callback)
  this._midiInput = midiInput
  if (this._midiInput)
    this._midiInput.addEventListener('midimessage', this._callback)
}


var WebStorage = exports.Storage = function() {}

// Gets an array buffer through an ajax request, then calls `done(err, arrayBuffer)`
WebStorage.prototype.get = function(url, done) {
  var req = new XMLHttpRequest()

  req.onload = function(e) {
    if (this.status === 200)
      done(null, this.response)
    else done(new Error('HTTP ' + this.status + ': ' + this.statusText))
  }

  req.onerror = function(e) {
    done(e)
  }

  req.open('GET', url, true)
  req.responseType = 'arraybuffer'
  req.send()
}