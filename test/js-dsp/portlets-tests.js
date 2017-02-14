var assert = require('assert')
var _ = require('underscore')
var portlets = require('../../lib/js-dsp/portlets')
var Pd = require('../../index')
var helpers = require('../helpers')

describe('js-dsp.portlets', function() {

  afterEach(function() { helpers.afterEach() })

  describe('DspInlet', function() {

    var DummyObject = function(dspOutlet) {
      this.nextBuf = null
      this.dspOutlet = new portlets.DspOutlet(this, 0)
    }

    DummyObject.prototype.tick = function() { this.dspOutlet.buffer = this.nextBuf }

    var audio
    beforeEach(function() {
      audio = new helpers.TestAudio()
      audio.frame = 0
      audio.sampleRate = 44100
      audio.blockSize = 4410
      Pd.start({ audio: audio })
    })

    it('should update itself when connection/disconnection', function() {
      var dspInlet = new portlets.DspInlet({}, 0)
      var dspOutlet1 = new portlets.DspOutlet({}, 0)
      var dspOutlet2 = new portlets.DspOutlet({}, 0)
      var outlet = new portlets.Outlet({}, 0)

      assert.notEqual(dspInlet._runTick, dspInlet._tickNoSource)

      dspInlet.start()
      assert.equal(dspInlet._runTick, dspInlet._tickNoSource)
      assert.deepEqual(dspInlet.dspSources, [])

      dspOutlet1.connect(dspInlet)
      assert.equal(dspInlet._runTick, dspInlet._tickOneSource)
      assert.deepEqual(dspInlet.dspSources, [ dspOutlet1 ])

      outlet.connect(dspInlet)
      assert.equal(dspInlet._runTick, dspInlet._tickOneSource)
      assert.deepEqual(dspInlet.dspSources, [ dspOutlet1 ])

      dspOutlet2.connect(dspInlet)
      assert.equal(dspInlet._runTick, dspInlet._tickSeveralSources)
      assert.deepEqual(dspInlet.dspSources, [ dspOutlet1, dspOutlet2 ])
    })

    it('should pass over the buffer from source if only one source', function() {
      var buf1 = new Float32Array(10)
      var buf2 = new Float32Array(10)
      var sourceObj = new DummyObject()
      var dspInlet = new portlets.DspInlet({}, 0)
      sourceObj.dspOutlet.connect(dspInlet)

      sourceObj.nextBuf = buf1
      dspInlet.tick()
      assert.equal(dspInlet.buffer, buf1)

      audio.frame = 10
      sourceObj.nextBuf = buf2
      dspInlet.tick()
      assert.equal(dspInlet.buffer, buf2)
    })

    it('should compute the sum of sources if several sources', function() {
      var buf1 = new Float32Array([ 1, 2, 3, 4, 5 ])
      var buf2 = new Float32Array([ 10, 20, 30, 40, 50 ])
      var buf3 = new Float32Array([ 100, 200, 300, 400, 500 ])
      var sourceObj1 = new DummyObject
      var sourceObj2 = new DummyObject
      var sourceObj3 = new DummyObject
      var dspInlet = new portlets.DspInlet({}, 0)
      sourceObj1.dspOutlet.connect(dspInlet)
      sourceObj2.dspOutlet.connect(dspInlet)
      sourceObj3.dspOutlet.connect(dspInlet)

      sourceObj1.nextBuf = buf1
      sourceObj2.nextBuf = buf2
      sourceObj3.nextBuf = buf3
      dspInlet.tick()
      assert.deepEqual(dspInlet.buffer.slice(0, 5), new Float32Array([ 111, 222, 333, 444, 555 ]))
    })

  })

})