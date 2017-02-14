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
  , utils = require('../core/utils')
  , corePortlets = require('../core/portlets')
  , PdObject = require('../core/PdObject')
  , pdGlob = require('../global')
  , mixins = require('./mixins')
  , vectors = require('./vectors')


var DspInlet = exports.DspInlet = corePortlets.Inlet.extend(mixins.TickMixin, {

  init: function() {
    mixins.TickMixin.init.apply(this, arguments)
    this.dspSources = []
  },

  start: function() {
    this._updateTickMethod()
  },

  connection: function() {
    this._updateTickMethod()
  },

  disconnection: function() {
    this._updateTickMethod()
  },

  // In case only one source, we reference directly its output buffer to avoid 
  // copies / allocations as much as possible
  _tickOneSource: function() {
    this.dspSources[0].obj.tick()
    this.buffer = this.dspSources[0].buffer
  },

  // In case several sources, we have to compute their sum
  _tickSeveralSources: function() {
    var sourceCount = this.dspSources.length
    for (i = 0; i < sourceCount; i++) 
      this.dspSources[i].obj.tick() 
    vectors.add(this.buffer, _.pluck(this.dspSources, 'buffer'))
  },

  _tickNoSource: function() {},

  _updateTickMethod: function() {
    this.dspSources = this.connections.filter(function(source) { return source instanceof DspOutlet })
    
    // If several sources, we need to allocate a new buffer for computing the sum. 
    if (this.dspSources.length > 1) {
      this.buffer = new Float32Array(pdGlob.audio.blockSize)
      this._runTick = this._tickSeveralSources
    } else if (this.dspSources.length === 1)
      this._runTick = this._tickOneSource
    else if (this.dspSources.length === 0) {
      this.buffer = new Float32Array(pdGlob.audio.blockSize)
      this._runTick = this._tickNoSource
    }
  }

})


var DspOutlet = exports.DspOutlet = corePortlets.Outlet.extend({

  start: function() {
    this.buffer = new Float32Array(pdGlob.audio.blockSize)
  }
})

exports.Inlet = corePortlets.Inlet

exports.Outlet = corePortlets.Outlet

exports.declareObjects = function(library) {
  library['outlet'] = function() {}
  library['outlet~'] = function() {}
  library['inlet'] = function() {}
  library['inlet~'] = function() {}
}