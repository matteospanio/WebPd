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
  , mixins = require('../core/mixins')
  , pdGlob = require('../global')
  , portlets = require('./portlets')
  , vectors = require('./vectors')
  , engine = require('./dsp-engine')


var VarOrConstantDspInlet = portlets.DspInlet.extend({
  start: function() {
    portlets.DspInlet.prototype.start.apply(this, arguments)
    this.obj._updateRunTick(this.id, this.dspSources.length)
  },
  connection: function() {
    portlets.DspInlet.prototype.connection.apply(this, arguments)
    this.obj._updateRunTick(this.id, this.dspSources.length)
  },
  disconnection: function() {
    portlets.DspInlet.prototype.disconnection.apply(this, arguments)
    this.obj._updateRunTick(this.id, this.dspSources.length)
  }
})


var VarOrConstantDspObject = engine.DspObject.extend({

  _updateRunTick: function(inletId, dspSourceCount) {
    if (dspSourceCount >= 1)
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


// Baseclass for tabwrite~, tabread~ and others ...
var TabDspObject = engine.DspObject.extend({

  init: function(args) {
    engine.DspObject.prototype.init.apply(this, arguments)
    this.array = new mixins.Reference('array')
  },

  destroy: function() {
    engine.DspObject.prototype.destroy.apply(this, arguments)
    this.array.destroy()
  }

})


exports.declareObjects = function(library) {

  library['dac~'] = engine.DspEndPoint.extend({

    type: 'dac~',
    endPointPriority: 0,
    inletDefs: [portlets.DspInlet, portlets.DspInlet],

    tick: function(offset, length) {
      this._offset = offset
      engine.DspEndPoint.prototype.tick.apply(this, arguments)
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

          // Cancel previous ramp
          if (this.obj._rampEndEvent) {
            pdGlob.clock.unschedule(this.obj._rampEndEvent)
            this.obj._rampEndEvent = null
          }

          // Start either ramp, or jump to value
          if (duration)
            this.obj._toTickRamp(y1, duration)
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
    },

    _runTickRamp: function() {
      this.value = vectors.ramp(this.outlets[0].getBuffer(), this.value, this.increment)
    },

    _toTickConstant: function(newValue) {
      this.value = newValue
      this._runTick = this._runTickConstant
    },

    _toTickRamp: function(newValue, duration) {
      var self = this
      this.increment = (newValue - this.value) / (duration * pdGlob.audio.sampleRate / 1000)
      this._runTick = this._runTickRamp
      this._rampEndEvent = pdGlob.clock.schedule(function() { 
        self._toTickConstant(newValue) 
      }, pdGlob.audio.time + duration)
    }
  })


  // TODO: tabread4~
  library['tabread~'] = TabDspObject.extend({
    type: 'tabread~',

    inletDefs: [
      VarOrConstantDspInlet.extend({
        
        message: function(args) {
          var method = args[0]
          if (method === 'set')
            this.obj.array.set(args[1])
          else
            console.error('unknown method ' + method)
        }

      })
    ],
    outletDefs: [portlets.DspOutlet],

    init: function(args) {
      var arrayName = args[0]
      var self = this
      TabDspObject.prototype.init.apply(this, arguments)
      this.array.on('changed', function() { self._updateRunTick() })
      if (arrayName) this.array.set(arrayName)
    },

    _runTickInterpolate: function() {
      vectors.linearInterpolation(this.o(0).getBuffer(), this.array.resolved.data, this.i(0).getBuffer())
    },

    _runTickZeros: function() {
      vectors.constant(this.o(0).getBuffer(), 0)
    },

    _updateRunTick: function(inletId, dspSourceCount) {
      if (dspSourceCount >= 1 && this.array.resolved)
        this._runTick = this._runTickInterpolate
      else
        this._runTick = this._runTickZeros
    }

  })

  // Which order in Dsp? Before or after dac?
  library['delwrite~'] = engine.DspEndPoint.extend(mixins.NamedMixin, mixins.EventEmitterMixin, {

    type: 'delwrite~',
    endPointPriority: 1,
    nameIsUnique: true,

    inletDefs: [ portlets.DspInlet ],

    init: function(args) {
      engine.DspEndPoint.prototype.init.apply(this, arguments)
      var name = args[0]
      this._delayLineSize = (args[1] || 1000) / 1000 // in seconds
      this._delayLine = null
      this._position = 0
      if (name) this.setName(name)
    },

    destroy: function() {
      engine.DspEndPoint.prototype.destroy.apply(this, arguments)
      mixins.NamedMixin.destroy.apply(this, arguments)
      mixins.EventEmitterMixin.destroy.apply(this, arguments)
    },

    delayLine: function() {
      if (!this._delayLine)
        this._delayLine = new Float32Array(this._delayLineSize * pdGlob.audio.sampleRate)
      return this._delayLine
    },

    getDelayedPosition: function(delayFrames) {
      var delayedPosition = this._position - delayFrames
      while (delayedPosition < 0)
        delayedPosition += this.delayLine().length
      return delayedPosition
    },

    _runTick: function() {
      this._position = vectors.circularBufferWrite(this.delayLine(), this.i(0).getBuffer(), this._position)
    }

  })

  library['delread~'] = engine.DspObject.extend({

    type: 'delread~',

    inletDefs: [
      portlets.Inlet.extend({
        message: function(args) {
          this.obj.setDelayTime(args[0])
        }
      })
    ],
    outletDefs: [ portlets.DspOutlet ],

    init: function(args) {
      engine.DspObject.prototype.init.apply(this, arguments)
      var self = this
      var delayName = args[0]
      
      this._delWrite = new mixins.Reference('delwrite~')
      this._delWrite.on('changed', function() {
        self._updateRunTick()
        self._updatePosition()
      })

      this._delayTime = args[1] || 0
      if (delayName) 
        this._delWrite.set(delayName)
    },

    start: function() {
      engine.DspObject.prototype.start.apply(this, arguments)
      this.setDelayTime(this._delayTime)
    },

    destroy: function() {
      engine.DspObject.prototype.init.apply(this, arguments)
      this._delWrite.destroy()
    },

    setDelayTime: function(delayTime) {
      this._delayTime = delayTime
      this._delayFrames = Math.round(pdGlob.audio.sampleRate * delayTime / 1000)
      this._updatePosition()
    },

    _updatePosition: function() {
      if (this._delWrite.resolved)
        this._position = this._delWrite.resolved.getDelayedPosition(this._delayFrames)
    },

    _runTickZeros: function() {
      vectors.constant(this.o(0).getBuffer(), 0)
    },

    _runTickReadDelay: function() {
      this._position = vectors.circularBufferRead(
        this.o(0).getBuffer(), this._delWrite.resolved.delayLine(), this._position)
    },

    _updateRunTick: function() {
      if (this._delWrite.resolved)
        this._runTick = this._runTickReadDelay
      else
        this._runTick = this._runTickZeros
    }

  })

  /*
  library['lop~'] = Pd.Object.extend({

    inletDefs: [ portlets.DspInlet, portlets.Inlet ],
    outletDefs: ['outlet~'],

      init: function(freq) {
          this.ym1 = 0;
          this.setCutOffFreq(freq || 0);
          // Only zeros when no dsp connected 
          this.dspTick = this.dspTickZeros;
          this.on('inletConnect', this._onInletConnect);
          this.on('inletDisconnect', this._onInletDisconnect);
      },

      load: function() {
          this.setCutOffFreq(this.cutOffFreq);
      },

      // TODO: recalculate when sample rate changes.
      setCutOffFreq: function(freq) {
          this.assertIsNumber(freq, 'invalid cut-off frequency ' + freq);
          this.cutOffFreq = freq;
          freq = Math.max(0, freq);
          this.coef = freq * 2 * Math.PI / this.patch.sampleRate;
          this.coef = Math.max(0, this.coef);
          this.coef = Math.min(1, this.coef);
      },

      dspTickFiltering: function() {
          var inBuff = this.inlets[0].getBuffer(),
              outBuff = this.outlets[0].getBuffer(),
              coef = this.coef, i, length;

          // y[i] := y[i-1] + α * (x[i] - y[i-1]) | source : wikipedia
          outBuff[0] = this.ym1 + coef * (inBuff[0] - this.ym1);
          for (i = 1, length = outBuff.length; i < length; i++) {
              outBuff[i] = outBuff[i-1] + coef * (inBuff[i] - outBuff[i-1]);
          }
          this.ym1 = outBuff[length-1];
      },

      message: function(inletId, msg) {
          if (inletId === 0) {
              if (msg === 'clear') this.ym1 = 0;
          } else if (inletId === 1) {
              this.setCutOffFreq(msg);
          }
      },

      // On inlet connection, we change dspTick method if appropriate
      _onInletConnect: function() {
          if (this.inlets[0].hasDspSources()) {
              this.dspTick = this.dspTickFiltering;
          }
      },

      // On inlet disconnection, we change dspTick method if appropriate
      _onInletDisconnect: function() {
          if (!this.inlets[0].hasDspSources()) {
              this.dspTick = this.dspTickZeros;
          }
      }
});
*/
  library['hip~'] = null
  library['bp~'] = null
  library['vcf~'] = null
  library['clip~'] = null
  library['adc~'] = null
}