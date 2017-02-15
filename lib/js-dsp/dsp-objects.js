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
  , PdObject = require('../core/PdObject')
  , pdGlob = require('../global')
  , portlets = require('./portlets')
  , vectors = require('./vectors')
  , engine = require('./dsp-engine')

var DspEndPoint = engine.DspObject.extend({

  start: function() {
    engine.DspObject.prototype.start.apply(this)
    pdGlob.audio.registerEndPoint(this)
  }

})


var VarOrConstantDspInlet = portlets.DspInlet.extend({
  start: function() {
    portlets.DspInlet.prototype.start.apply(this, arguments)
    this.obj._updateRunTick(this.id)
  },
  connection: function() {
    portlets.DspInlet.prototype.connection.apply(this, arguments)
    this.obj._updateRunTick(this.id)
  },
  disconnection: function() {
    portlets.DspInlet.prototype.disconnection.apply(this, arguments)
    this.obj._updateRunTick(this.id)
  }
})


var VarOrConstantDspObject = engine.DspObject.extend({

  _updateRunTick: function(inletId) {
    if (this.inlets[inletId].dspSources.length)
      this._runTick = this._runTickVariable
    else
      this._runTick = this._runTickConstant
  }

})


var OscDspObject = exports.OscDspObject = VarOrConstantDspObject.extend({
  // TODO : reset phase takes float and no bang
  // TODO : recalculate stuff on sample rate change. (Useless ?)
  inletDefs: [
    
    VarOrConstantDspInlet.extend({
      message: function(args) {
        this.obj.setFreq(args[0])
      }
    }),

    portlets.Inlet.extend({ 
      message: function(args) {
        this.obj.setPhase(args[0])
      }
    })

  ],
  outletDefs: [ portlets.DspOutlet ],

  init: function(args) {
    VarOrConstantDspObject.prototype.init.apply(this, arguments)
    this.setFreq(args[0] || 0)
    this.setPhase(0)
  },

  start: function() {
    VarOrConstantDspObject.prototype.start.apply(this, arguments)
    this.J = this._computeJ()
    this.setFreq(this.freq)
  },

  setPhase: function(phase) {
    this.phase = phase
  },

  // Sets the frequency for the constant frequency _runTick method.
  setFreq: function(freq) {
    this.freq = freq
    this.K = this.freq * this.J
  },

  // Calculates the cos taking the frequency from dsp inlet
  _runTickVariable: function() {
    this.phase = this._opVariable(this.outlets[0].getBuffer(), this.phase, this.J, this.inlets[0].getBuffer())
  },

  // Calculates the cos with a constant frequency from first inlet
  _runTickConstant: function() {
    this.phase = this._opConstant(this.outlets[0].getBuffer(), this.phase, this.K)
  }

})


var ArithmDspObject = exports.ArithmDspObject = VarOrConstantDspObject.extend({
  inletDefs: [
    portlets.DspInlet,
    VarOrConstantDspInlet.extend({ 
      message: function(args) {
        this.obj.setVal(args[0])
      }
    })
  ],
  outletDefs: [ portlets.DspOutlet ],

  init: function(args) {
    VarOrConstantDspObject.prototype.init.apply(this, arguments)
    this.setVal(args[0])
  },

  setVal: function(val) {
    this.val = val
  },

  _runTickVariable: function() {
    this._opVariable(this.outlets[0].getBuffer(), [ this.inlets[0].getBuffer(), this.inlets[1].getBuffer() ])
  },

  _runTickConstant: function() {
    this._opConstant(this.outlets[0].getBuffer(), this.inlets[0].getBuffer(), this.val)
  }
})


exports.declareObjects = function(library) {

  library['dac~'] = DspEndPoint.extend({

    type: 'dac~',
    inletDefs: [portlets.DspInlet, portlets.DspInlet],

    tick: function(offset, length) {
      this._offset = offset
      DspEndPoint.prototype.tick.apply(this, arguments)
    },

    _runTick: function() {
      var ch, channelCount = this.inlets.length
      for (ch = 0; ch < channelCount; ch++)
        pdGlob.audio.pushBuffer(ch, this._offset, this.inlets[ch].getBuffer())
    }

  })

  library['osc~'] = OscDspObject.extend({
    _computeJ: function() { return 2 * Math.PI / pdGlob.audio.sampleRate },
    _opVariable: vectors.variableCos,
    _opConstant: vectors.cos
  })

  library['phasor~'] = OscDspObject.extend({
    _computeJ: function() { return 1 / pdGlob.audio.sampleRate },
    _opVariable: vectors.variablePhasor,
    _opConstant: vectors.phasor
  })

  library['triangle~'] = OscDspObject.extend({
    _computeJ: function() { return 1 / pdGlob.audio.sampleRate },
    _opVariable: vectors.variableTriangle,
    _opConstant: vectors.triangle
  })

  library['square~'] = OscDspObject.extend({
    _computeJ: function() { return 1 / pdGlob.audio.sampleRate },
    _opVariable: vectors.variableSquare,
    _opConstant: vectors.square
  })

  library['*~'] = ArithmDspObject.extend({
    type: '*~',
    _opVariable: vectors.mult,
    _opConstant: vectors.multConstant
  })

  library['+~'] = ArithmDspObject.extend({
    type: '+~',
    _opVariable: vectors.add,
    _opConstant: vectors.addConstant
  })

  library['-~'] = ArithmDspObject.extend({
    type: '-~',
    _opVariable: vectors.sub,
    _opConstant: vectors.subConstant
  })

  library['/~'] = ArithmDspObject.extend({
    type: '/~',
    _opVariable: vectors.sub,
    _opConstant: vectors.subConstant
  })

  library['noise~'] = engine.DspObject.extend({
    outletDefs: [ portlets.DspOutlet ],
    _runTick: function() { vectors.random(this.outlets[0].getBuffer(), -1, 1) }
  })

  library['sig~'] = engine.DspObject.extend({
    inletDefs: [ 
      portlets.Inlet.extend({
        message: function(args) {
          this.obj.setVal(args[0])
        }
      }) 
    ],
    outletDefs: [ portlets.DspOutlet ],
    init: function(args) {
      engine.DspObject.prototype.init.apply(this, arguments)
      this.setVal(args[0])
    },
    setVal: function(val) { this.val = val },
    _runTick: function() { vectors.constant(this.outlets[0].getBuffer(), this.val) }
  })

  library['line~'] = engine.DspObject.extend({

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          var y1 = args[0]
          var duration = args[1]
          if (duration)
            this.obj._toTickVariable(y1, duration)
          else
            this.obj._toTickConstant(y1)
        }
      }),
      portlets.UnimplementedOutlet
    ],
    outletDefs: [ portlets.DspOutlet ],

    start: function() {
      engine.DspObject.prototype.start.apply(this, arguments)
      this._toTickConstant(0)
    },

    _runTickConstant: function() {
      vectors.constant(this.outlets[0].getBuffer(), this.value)
      //console.log('CCC', this.value, this.outlets[0].getBuffer().length)
    },

    _runTickVariable: function() {
      this.value = vectors.ramp(this.outlets[0].getBuffer(), this.value, this.increment)
      //console.log(this.value, this.outlets[0].getBuffer().length)
    },

    _toTickConstant: function(newValue) {
      console.log('constant', newValue, pdGlob.audio.frame)
      this.value = newValue
      this._runTick = this._runTickConstant
    },

    _toTickVariable: function(newValue, duration) {
      var self = this
      this.increment = (newValue - this.value) / (duration * pdGlob.audio.sampleRate / 1000)
      console.log('variable', this.increment, this.value, pdGlob.audio.frame)
      this._runTick = this._runTickVariable
      pdGlob.clock.schedule(function() { self._toTickConstant(newValue) }, pdGlob.audio.time + duration - 1)
    }
  })

  library['lop~'] = null
  library['hip~'] = null
  library['bp~'] = null
  library['vcf~'] = null
  library['tabread~'] = null
  library['delwrite~'] = null
  library['delread~'] = null
  library['clip~'] = null
  library['adc~'] = null
}