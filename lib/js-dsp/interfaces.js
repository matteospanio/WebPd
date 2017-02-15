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
var getUserMedia = require('getusermedia')
var pdGlob = require('../global')
var Audio = exports.Audio = require('./dsp-engine').Audio
var Clock = exports.Clock = require('./dsp-engine').Clock


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