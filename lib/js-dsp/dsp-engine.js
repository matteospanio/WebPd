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
var utils = require('../core/utils')
var corePortlets = require('../core/portlets')
var PdObject = require('../core/PdObject')
var pdGlob = require('../global')
var vectors = require('./vectors')


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

Audio.prototype.pushBuffer = function(ch, offset, buffer) {
  this._buffers[ch].set(buffer, offset)
}

// Pulls a complete block in several steps, stopping each time
// an event is scheduled
Audio.prototype.tick = function() {
  var blockEnd = this.frame + this.blockSize
  var endPointsCount = this._endPoints.length
  var offset = 0
  var nextFrame, subBlockSize, i
  while (this.frame !== blockEnd) {

    // Pulls next sub-block
    nextFrame = pdGlob.clock.tick(blockEnd)
    subBlockSize = nextFrame - this.frame
    if (subBlockSize) {
      for (i = 0; i < endPointsCount; i++)
        this._endPoints[i].tick(offset, subBlockSize)
    }
    offset += subBlockSize
    this.frame = nextFrame
  }
}

var _BufferMixin = {
  getBuffer: function() {
    return this._buffer.subarray(this._offset, this._offset + this._length)
  },

  setBufferRange: function(offset, length) {
    this._offset = offset
    this._length = length
  }
}

var DspInlet = exports.DspInlet = corePortlets.Inlet.extend(_BufferMixin, {

  init: function() {
    this.frame = -1
    this.dspSources = []
  },

  start: function() {
    this.setBufferRange(0, pdGlob.audio.blockSize)
    this._updateTickMethod()
  },

  connection: function() {
    this._updateTickMethod()
  },

  disconnection: function() {
    this._updateTickMethod()
  },

  tick: function(offset, length) {
    if (this.frame !== pdGlob.audio.frame) {
      this.setBufferRange(offset, length)
      this._runTick()
      this.frame = pdGlob.audio.frame
    }
  },

  _tickNoSource: function() {},

  // In case only one source, we reference directly its output buffer to avoid 
  // copies / allocations as much as possible
  _tickOneSource: function() {
    this.dspSources[0].obj.tick(this._offset, this._length)
    this._buffer = this.dspSources[0]._buffer
  },

  // In case several sources, we have to compute their sum
  _tickSeveralSources: function() {
    var sourceCount = this.dspSources.length
    for (i = 0; i < sourceCount; i++) 
      this.dspSources[i].obj.tick(this._offset, this._length) 
    vectors.add(this.getBuffer(), 
      _.map(this.dspSources, function(source) { return source.getBuffer () }))
  },

  _updateTickMethod: function() {
    this.dspSources = this.connections.filter(function(source) { return source instanceof DspOutlet })
    
    // If several sources, we need to allocate a new buffer for computing the sum. 
    if (this.dspSources.length > 1) {
      this._buffer = new Float32Array(pdGlob.audio.blockSize)
      this._runTick = this._tickSeveralSources
    } else if (this.dspSources.length === 1)
      this._runTick = this._tickOneSource
    else if (this.dspSources.length === 0) {
      this._buffer = new Float32Array(pdGlob.audio.blockSize)
      this._runTick = this._tickNoSource
    }
  }

})


var DspOutlet = exports.DspOutlet = corePortlets.Outlet.extend(_BufferMixin, {

  start: function() {
    this._buffer = new Float32Array(pdGlob.audio.blockSize)
    this.setBufferRange(0, this._buffer.length)
  }

})


var DspObject = exports.DspObject = PdObject.extend({

  init: function() {
    this.frame = -1
  },

  tick: function(offset, length) {
    if (this.frame !== pdGlob.audio.frame) {
      var portlet, i, portletCount

      // Run tick upstream on all inlets
      for (i = 0, portletCount = this.inlets.length; i < portletCount; i++) {
        portlet = this.inlets[i]
        if (portlet instanceof DspInlet) 
          portlet.tick(offset, length)
      }

      // Set the right buffer range for all outlets
      for (i = 0, portletCount = this.outlets.length; i < portletCount; i++) {
        portlet = this.outlets[i]
        if (portlet instanceof DspOutlet) 
          portlet.setBufferRange(offset, length)
      }
      this._runTick()
      this.frame = pdGlob.audio.frame
    } 
  }

})


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
