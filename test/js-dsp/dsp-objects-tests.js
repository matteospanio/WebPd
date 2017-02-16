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
  var audio, patch

  var DummySourceObject = engine.DspObject.extend({
    inletDefs: [],
    outletDefs: [ portlets.DspOutlet ],
    init: function() { this.nextBuffer = null },
    _runTick: function() { this.o(0)._buffer = this.nextBuffer }
  })

  beforeEach(function() {
    audio = new interfaces.Audio({ sampleRate: 44100 })
    clock = new interfaces.Clock()
    Pd.start({ audio: audio, clock: clock })
    patch = Pd.createPatch()
    pdGlob.library['DummySourceObject'] = DummySourceObject
  })

  afterEach(function() { helpers.afterEach() })

  describe('ArithmDspObject', function() {

    it('should run tick constant when no dsp object connected', function() {
      var arithm = patch.createObject('+~', [ 3.4 ])
      arithm.i(0)._buffer = new Float32Array([ 1, 2, 3, 4 ])
      arithm.o(0)._buffer = new Float32Array(arithm.i(0)._buffer.length)
      arithm.tick(0, 4)
      assert.deepEqual(arithm.o(0).getBuffer(), new Float32Array([ 4.4, 5.4, 6.4, 7.4 ]))
    })

    it('should run tick variable when dsp object connected', function() {
      var dspLeft = patch.createObject('DummySourceObject')
      var dspRight = patch.createObject('DummySourceObject')
      var arithm = patch.createObject('+~', [ 22.2 ])
      dspLeft.o(0).connect(arithm.i(0))
      dspRight.o(0).connect(arithm.i(1))

      dspLeft.nextBuffer = new Float32Array([ 1, 2, 3, 4 ])
      dspRight.nextBuffer = new Float32Array([ 5, 6, 7, 8 ])
      arithm.tick(0, 4)
      assert.deepEqual(arithm.o(0).getBuffer(), new Float32Array([ 6, 8, 10, 12 ]))
    })

  })

  describe('OscDspObject', function() {

    it('should run tick constant when no dsp object connected', function() {
      var osc = patch.createObject('osc~', [ 440 ])
      var K = osc.K

      osc.o(0)._buffer = new Float32Array(4)
      osc.tick(0, 4)
      assert.deepEqual(osc.o(0).getBuffer(), 
        new Float32Array([ Math.cos(K*1), Math.cos(K*2), Math.cos(K*3), Math.cos(K*4) ]))
    })

    it('should run tick variable when dsp object connected', function() {
      var frequencies = patch.createObject('DummySourceObject')
      var osc = patch.createObject('osc~', [ 0 ])
      var J = osc.J
      frequencies.o(0).connect(osc.i(0))

      frequencies.nextBuffer = new Float32Array([ 770, 550, 330, 110 ])
      osc.tick(0, 4)
      assert.deepEqual(osc.o(0).getBuffer(), 
        new Float32Array([ Math.cos(J * 770), Math.cos(J * (770 + 550)), 
          Math.cos(J * (770 + 550 + 330)), Math.cos(J * (770 + 550 + 330 + 110)) ]))
    })
    
  })

  describe('dac~', function() {

    it('should push buffers to audio interface', function() {
      var dac = patch.createObject('dac~')
      var leftDsp = patch.createObject('DummySourceObject')
      var rightDsp = patch.createObject('DummySourceObject')
      leftDsp.o(0).connect(dac.i(0))
      rightDsp.o(0).connect(dac.i(1))

      // frame 0
      leftDsp.nextBuffer = new Float32Array([ 1, 2, 3, 4, 5, 6, 7, 8 ])
      rightDsp.nextBuffer = new Float32Array([ 10, 20, 30, 40, 50, 60, 70, 80 ])
      dac.tick(0, 4)
      assert.deepEqual(audio._buffers[0].slice(0, 4), new Float32Array([ 1, 2, 3, 4 ]))
      assert.deepEqual(audio._buffers[1].slice(0, 4), new Float32Array([ 10, 20, 30, 40 ]))

      // frame 4, same block (therefore we add an offset of 4 from the previous iteration)
      audio.frame = 4
      dac.tick(4, 4)
      assert.deepEqual(audio._buffers[0].slice(0, 8), new Float32Array([ 1, 2, 3, 4, 5, 6, 7, 8 ]))
      assert.deepEqual(audio._buffers[1].slice(0, 8), new Float32Array([ 10, 20, 30, 40, 50, 60, 70, 80 ]))
    })

  })

  describe('noise~', function() {

    it('should generate noise', function() {
      var noise = patch.createObject('noise~')
      noise.tick(0, audio.blockSize)
      assert.ok(_.reduce(noise.o(0).getBuffer(), function(a, b) { return a + b }, 0) !== 0)
    })
    
  })

  describe('sig~', function() {

    it('should generate constant sig', function() {
      var sig = patch.createObject('sig~', [3])
      var i, buffer = sig.o(0).getBuffer()
      
      sig.tick(0, audio.blockSize)
      for (i = 0; i < buffer.length; i++)
        assert.equal(helpers.round(buffer[i]), 3)

      sig.i(0).message([ -8.8 ])
      audio.frame += audio.blockSize
      sig.tick(0, audio.blockSize)
      for (i = 0; i < buffer.length; i++)
        assert.equal(helpers.round(buffer[i]), -8.8)      
    })
    
  })

  describe('line~', function() {

    it('should output a constant when receiving a single value', function() {
      var line = patch.createObject('line~')
      
      line.tick(0, 5)
      assert.deepEqual(line.o(0).getBuffer(), new Float32Array(5))

      audio.frame = 5
      line.i(0).message([ 5.5 ])
      line.tick(0, 5)
      assert.deepEqual(line.o(0).getBuffer(), new Float32Array([ 5.5, 5.5, 5.5, 5.5, 5.5 ]))      
    })

    it('should ramp to value when receiving number and duration', function() {
      var line = patch.createObject('line~')
      var nextBlockSize
      audio.sampleRate = 10
      audio.blockSize = 10

      line.i(0).message([ 1 ])
      line.i(0).message([ 2, 1000 ])

      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      line.tick(0, nextBlockSize)
      helpers.assertAboutEqual(line.o(0).getBuffer(), 
        new Float32Array([ 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2 ]))
      audio.frame += nextBlockSize
            
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      line.tick(0, nextBlockSize)
      helpers.assertAboutEqual(line.o(0).getBuffer(), [ 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 ])
      audio.frame += nextBlockSize
    })

    it('should work when interrupting a ramp', function() {
      var line = patch.createObject('line~')
      var nextBlockSize
      audio.sampleRate = 10
      audio.blockSize = 5

      line.i(0).message([ 1 ])
      line.i(0).message([ 2, 1000 ])

      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      line.tick(0, nextBlockSize)
      helpers.assertAboutEqual(line.o(0).getBuffer(), new Float32Array([ 1.1, 1.2, 1.3, 1.4, 1.5 ]))
      audio.frame += nextBlockSize

      // We interrupt the previous ramp with a new one
      line.i(0).message([ 1, 250 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      line.tick(0, nextBlockSize)
      helpers.assertAboutEqual(line.o(0).getBuffer(), new Float32Array([ 1.3, 1.1 ]))
      audio.frame += nextBlockSize

      // This should trigger the end of line event and go back to constant
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      assert.equal(clock._events.length, 0)

      line.tick(0, nextBlockSize)
      helpers.assertAboutEqual(line.o(0).getBuffer(), new Float32Array([ 1, 1, 1, 1, 1 ]))
      audio.frame += nextBlockSize
    })

  })

  describe('tabread~', function() {

    it('should interpolate from the array with corresponding name', function() {
      var array = patch.createObject('array', [ 'bla', 10 ])
      var tabread = patch.createObject('tabread~', [ 'bla' ])
      var indices = patch.createObject('DummySourceObject')

      assert.equal(tabread.array.resolved, array)
      array.data = new Float32Array([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ])

      indices.o(0).connect(tabread.i(0))
      indices.nextBuffer = new Float32Array([ 1.5, 2, 3, 4 ])
      tabread.tick(0, 4)
      helpers.assertAboutEqual(tabread.o(0).getBuffer(), new Float32Array([ 3, 4, 6, 8 ]))
    })

    it('should resolve new array if changing name', function() {
      var array = patch.createObject('array', [ 'blo', 10 ])
      var tabread = patch.createObject('tabread~', [ 'bla' ])
      var indices = patch.createObject('DummySourceObject')

      assert.equal(tabread.array.resolved, null)
      array.data = new Float32Array([ 0, 2, 4, 6, 8, 10, 12, 14, 16, 18 ])

      indices.o(0).connect(tabread.i(0))
      indices.nextBuffer = new Float32Array([ 1.5, 2, 3, 4 ])
      tabread.tick(0, 4)
      helpers.assertAboutEqual(tabread.o(0).getBuffer(), new Float32Array([ 0, 0, 0, 0 ]))

      audio.frame = 4
      indices.nextBuffer = new Float32Array([ 1.5, 2, 3, 4 ])
      tabread.i(0).message([ 'set', 'blo' ])
      assert.equal(tabread.array.resolved, array)
    })

  })

  describe('delwrite~/delread~', function() {

    it('should read with the appropriate delay', function() {
      audio.sampleRate = 10
      audio.blockSize = 5
      var source = patch.createObject('DummySourceObject')
      var delread1 = patch.createObject('delread~', [ 'bla', 500 ])
      var delwrite = patch.createObject('delwrite~', [ 'bla', 1000 ])
      var delread2 = patch.createObject('delread~', [ 'bla', 200 ])
      var delread3 = patch.createObject('delread~', [ 'blo', 200 ])
      source.o(0).connect(delwrite.i(0))
      assert.equal(delwrite.delayLine().length, audio.sampleRate)

      source.nextBuffer = new Float32Array([ 1, 2, 3, 4, 5 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      delwrite.tick(0, nextBlockSize)
      delread1.tick(0, nextBlockSize)
      delread2.tick(0, nextBlockSize)
      delread3.tick(0, nextBlockSize)
      helpers.assertAboutEqual(delread1.o(0).getBuffer(), new Float32Array([ 0, 0, 0, 0, 0 ]))
      helpers.assertAboutEqual(delread2.o(0).getBuffer(), new Float32Array([ 0, 0, 1, 2, 3 ]))
      helpers.assertAboutEqual(delread3.o(0).getBuffer(), new Float32Array([ 0, 0, 0, 0, 0 ]))
      audio.frame += nextBlockSize

      source.nextBuffer = new Float32Array([ 6, 7, 8, 9, 10 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      delwrite.tick(0, nextBlockSize)
      delread1.tick(0, nextBlockSize)
      delread2.tick(0, nextBlockSize)
      delread3.tick(0, nextBlockSize)
      helpers.assertAboutEqual(delread1.o(0).getBuffer(), new Float32Array([ 1, 2, 3, 4, 5 ]))
      helpers.assertAboutEqual(delread2.o(0).getBuffer(), new Float32Array([ 4, 5, 6, 7, 8 ]))
      helpers.assertAboutEqual(delread3.o(0).getBuffer(), new Float32Array([ 0, 0, 0, 0, 0 ]))
      audio.frame += nextBlockSize
    })

    it('should work changing the delay time', function() {
      audio.sampleRate = 10
      audio.blockSize = 5
      var source = patch.createObject('DummySourceObject')
      var delread = patch.createObject('delread~', [ 'bla', 200 ])
      var delwrite = patch.createObject('delwrite~', [ 'bla', 1000 ])
      source.o(0).connect(delwrite.i(0))

      source.nextBuffer = new Float32Array([ 1, 2, 3, 4, 5 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      delwrite.tick(0, nextBlockSize)
      delread.tick(0, nextBlockSize)
      helpers.assertAboutEqual(delread.o(0).getBuffer(), new Float32Array([ 0, 0, 1, 2, 3 ]))
      audio.frame += nextBlockSize

      source.nextBuffer = new Float32Array([ 6, 7, 8, 9, 10 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      delread.i(0).message([ 500 ])
      delwrite.tick(0, nextBlockSize)
      delread.tick(0, nextBlockSize)
      helpers.assertAboutEqual(delread.o(0).getBuffer(), new Float32Array([ 1, 2, 3, 4, 5 ]))
      audio.frame += nextBlockSize

      source.nextBuffer = new Float32Array([ 11, 12, 13, 14, 15 ])
      nextBlockSize = clock.tick(audio.frame + audio.blockSize)
      delread.i(0).message([ 100 ])
      delwrite.tick(0, nextBlockSize)
      delread.tick(0, nextBlockSize)
      helpers.assertAboutEqual(delread.o(0).getBuffer(), new Float32Array([ 10, 11, 12, 13, 14 ]))
      audio.frame += nextBlockSize
    })

  })

  describe('LopHipFilter', function() {

    it('should generate reasonable output signal :/', function() {
      var osc220 = patch.createObject('osc~', [ 220 ])
      var osc660 = patch.createObject('osc~', [ 660 ])
      var lop1 = patch.createObject('lop~', [ 440 ])
      var lop2 = patch.createObject('lop~', [ 440 ])
      osc220.o(0).connect(lop1.i(0))
      osc660.o(0).connect(lop2.i(0))
    
      lop1.tick(0, audio.blockSize)
      lop2.tick(0, audio.blockSize)
      assert.ok((_.max(lop1.o(0).getBuffer()) - _.max(lop2.o(0).getBuffer())) > 0.3)
    })

    it('should change cutoff frequency', function() {
      var maxVal
      var osc220 = patch.createObject('osc~', [ 220 ])
      var lop = patch.createObject('lop~', [ 440 ])
      osc220.o(0).connect(lop.i(0))
    
      lop.tick(0, audio.blockSize)
      maxVal = _.max(lop.o(0).getBuffer())

      lop.i(1).message([ 110 ])
      audio.frame = audio.blockSize
      lop.tick(0, audio.blockSize)
      assert.ok((maxVal - _.max(lop.o(0).getBuffer())) > 0.3)
    })

  })

})