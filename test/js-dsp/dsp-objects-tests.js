var assert = require('assert')
var _ = require('underscore')
var dsp = require('../../lib/js-dsp/dsp-objects')
var pdGlob = require('../../lib/global')
var portlets = require('../../lib/js-dsp/portlets')
var interfaces = require('../../lib/js-dsp/interfaces')
var engine = require('../../lib/js-dsp/dsp-engine')
var Pd = require('../../index')
var helpers = require('../helpers')

describe('js-dsp.dsp-objects', function() {
  var audio

  var DummySourceObject = engine.DspObject.extend({
    inletDefs: [],
    outletDefs: [ portlets.DspOutlet ],
    init: function() { this.nextBuffer = null },
    _runTick: function() { this.o(0)._buffer = this.nextBuffer }
  })

  beforeEach(function() {
    audio = new interfaces.Audio({ sampleRate: 44100 })
    Pd.start({ audio: audio })
    pdGlob.library['DummySourceObject'] = DummySourceObject
  })

  afterEach(function() { helpers.afterEach() })

  describe('ArithmDspObject', function() {

    it('should run tick constant when no dsp object connected', function() {
      var patch = Pd.createPatch()
      var obj = patch.createObject('+~', [ 3.4 ])

      obj.i(0)._buffer = new Float32Array([ 1, 2, 3, 4 ])
      obj.o(0)._buffer = new Float32Array(obj.i(0)._buffer.length)
      obj.tick(0, 4)
      assert.deepEqual(obj.o(0).getBuffer(), new Float32Array([ 4.4, 5.4, 6.4, 7.4 ]))
    })

    it('should run tick variable when dsp object connected', function() {
      var patch = Pd.createPatch()
      var dspLeft = patch.createObject('DummySourceObject')
      var dspRight = patch.createObject('DummySourceObject')
      var obj = patch.createObject('+~', [ 22.2 ])
      dspLeft.o(0).connect(obj.i(0))
      dspRight.o(0).connect(obj.i(1))

      dspLeft.nextBuffer = new Float32Array([ 1, 2, 3, 4 ])
      dspRight.nextBuffer = new Float32Array([ 5, 6, 7, 8 ])
      obj.tick(0, 4)
      assert.deepEqual(obj.o(0).getBuffer(), new Float32Array([ 6, 8, 10, 12 ]))
    })

  })

  describe('OscDspObject', function() {

    it('should run tick constant when no dsp object connected', function() {
      var patch = Pd.createPatch()
      var obj = patch.createObject('osc~', [ 440 ])
      var K = obj.K

      obj.o(0)._buffer = new Float32Array(4)
      obj.tick(0, 4)
      assert.deepEqual(obj.o(0).getBuffer(), 
        new Float32Array([ Math.cos(K*1), Math.cos(K*2), Math.cos(K*3), Math.cos(K*4) ]))
    })

    it('should run tick variable when dsp object connected', function() {
      var patch = Pd.createPatch()
      var frequencies = patch.createObject('DummySourceObject')
      var obj = patch.createObject('osc~', [ 0 ])
      var J = obj.J
      frequencies.o(0).connect(obj.i(0))

      frequencies.nextBuffer = new Float32Array([ 770, 550, 330, 110 ])
      obj.tick(0, 4)
      assert.deepEqual(obj.o(0).getBuffer(), 
        new Float32Array([ Math.cos(J * 770), Math.cos(J * (770 + 550)), 
          Math.cos(J * (770 + 550 + 330)), Math.cos(J * (770 + 550 + 330 + 110)) ]))
    })
    
  })

  describe('dac~', function() {

    it('should push buffers to audio interface', function() {
      var patch = Pd.createPatch()
      var dac = patch.createObject('dac~')
      var leftDsp = patch.createObject('DummySourceObject')
      var rightDsp = patch.createObject('DummySourceObject')
      leftDsp.o(0).connect(dac.i(0))
      rightDsp.o(0).connect(dac.i(1))

      // frame 0
      leftDsp.nextBuffer = new Float32Array([ 1, 2, 3, 4 ])
      rightDsp.nextBuffer = new Float32Array([ 10, 20, 30, 40 ])
      dac.tick(0, 4)
      assert.deepEqual(audio._buffers[0], new Float32Array([ 1, 2, 3, 4 ]))
      assert.deepEqual(audio._buffers[1], new Float32Array([ 10, 20, 30, 40 ]))

      // frame 4
      audio.frame = 4
      leftDsp.nextBuffer = new Float32Array([ 5, 6, 7, 8 ])
      rightDsp.nextBuffer = new Float32Array([ 50, 60, 70, 80 ])
      dac.tick(0, 4)
      assert.deepEqual(audio._buffers[0], new Float32Array([ 5, 6, 7, 8 ]))
      assert.deepEqual(audio._buffers[1], new Float32Array([ 50, 60, 70, 80 ]))
    })

  })

  describe('noise~', function() {

    it('should generate noise', function() {
      var patch = Pd.createPatch()
      var obj = patch.createObject('noise~')
      obj.tick(0, audio.blockSize)
      assert.ok(_.reduce(obj.o(0).getBuffer(), function(a, b) { return a + b }, 0) !== 0)
    })
    
  })

  describe('sig~', function() {

    it('should generate constant sig', function() {
      var patch = Pd.createPatch()
      var obj = patch.createObject('sig~', [3])
      var i, buffer = obj.o(0).getBuffer()
      
      obj.tick(0, audio.blockSize)
      for (i = 0; i < buffer.length; i++)
        assert.equal(helpers.round(buffer[i]), 3)

      obj.i(0).message([ -8.8 ])
      audio.frame += audio.blockSize
      obj.tick(0, audio.blockSize)
      for (i = 0; i < buffer.length; i++)
        assert.equal(helpers.round(buffer[i]), -8.8)      
    })
    
  })

})