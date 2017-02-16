var assert = require('assert')
var _ = require('underscore')
var engine = require('../../lib/js-dsp/dsp-engine')
var portlets = require('../../lib/js-dsp/portlets')
var pdGlob = require('../../lib/global')
var Pd = require('../../index')
var helpers = require('../helpers')

describe('js-dsp.dsp-engine', function() {

  var clock, audio
  beforeEach(function() {
    clock = new engine.Clock()
    audio = new engine.Audio({ sampleRate: 44100, blockSize: 4410 })
    Pd.start({ clock: clock, audio: audio })
  })
  afterEach(function() { helpers.afterEach() })

  describe('Clock', function() {

    it('should just do nothing if no event', function() {
      var blockEnd

      // block 0
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, audio.blockSize)

      // block 1
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, audio.blockSize * 2)
    })

    it('should schedule / execute simple events properly', function() {
      var called = []
      var blockEnd

      // We schedule events in wrong order of execution to test insertion
      clock.schedule(function() { called.push('event4') }, 10000)
      clock.schedule(function() { called.push('event3') }, 1975)
      clock.schedule(function() { called.push('event2') }, 1950)
      clock.schedule(function() { called.push('event1') }, 950)

      // frame 0, no event, the tick advance a whole block at once
      blockEnd = audio.frame + audio.blockSize
      assert.equal(clock.tick(blockEnd), audio.blockSize)
      assert.deepEqual(called, [])

      // event 1 at 0.95, so tick advances of 0.05 seconds, 
      audio.frame = 0.9 * audio.sampleRate
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.95 * audio.sampleRate))
      assert.deepEqual(called, [])
      // next tick event called and advances of the remaining 0.05 seconds to make a complete block 
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, ['event1'])

      // Same idea, but since there are 2 events this time, the block is cut in 3
      audio.frame = 1.9 * audio.sampleRate
      blockEnd = 2.0 * audio.sampleRate
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(1.95 * audio.sampleRate))
      assert.deepEqual(called, ['event1'])

      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(1.975 * audio.sampleRate))
      assert.deepEqual(called, ['event1', 'event2'])

      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, ['event1', 'event2', 'event3'])
    })

    it('should schedule / execute events with repetition properly', function() {
      var called = 0

      // We schedule events in wrong order of execution to test insertion
      clock.schedule(function() { called++ }, 10, 25)

      // frame 0, the tick advances to the first event
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.06 * audio.sampleRate))
      assert.deepEqual(called, 2)

      // Repetition 2
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.085 * audio.sampleRate))
      assert.deepEqual(called, 3)

      // Check that the repeted event has not added some junk
      assert.equal(clock._events.length, 1)
    })

    it('should allow scheduling events from within its own callback', function() {
      var called = 0

      var callback = function (event) {
        var time = audio.frame / audio.sampleRate * 1000
        clock.schedule(callback, event.timeTag + 25)   
        called++
      }
      // We schedule events in wrong order of execution to test insertion
      clock.schedule(callback, 10)

      // frame 0, the tick advances to the first event
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.06 * audio.sampleRate))
      assert.deepEqual(called, 2)

      // Repetition 2
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.085 * audio.sampleRate))
      assert.deepEqual(called, 3)
    })

    it('should unschedule events', function() {
      var called = 0
      var event
      var blockEnd

      // We schedule events in wrong order of execution to test insertion
      event = clock.schedule(function() { called++ }, 10, 25)

      // frame 0, the tick advances to the first event
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // unschedule
      clock.unschedule(event)
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, 1)
    })

    it('should allow unscheduling events from within its own callback', function() {
      var called = 0
      var event
      var blockEnd

      // We schedule events in wrong order of execution to test insertion
      event = clock.schedule(function() { 
        called++
        if (called === 2) 
          clock.unschedule(event) 
      }, 10, 25)

      // frame 0, the tick advances to the first event
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, 2)

      // Event should have been unscheduled
      blockEnd = audio.frame + audio.blockSize
      audio.frame += clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, 2)
    })

  })

  describe('Audio', function() {

    it('should generate blocks and take into account scheduled events', function() {
      var fakeEndPoint = {
        tick: function() { this.ticked.push(_.toArray(arguments)) },
        ticked: []
      }
      audio.blockSize = 500
      audio.sampleRate = 1000
      audio.registerEndPoint(fakeEndPoint)

      var called = 0

      // We schedule events in wrong order of execution to test insertion
      clock.schedule(function() { called++ }, 10, 110)
      
      audio.tick()
      assert.equal(called, 5) // 10, 120, 230, 340, 450
      assert.deepEqual(fakeEndPoint.ticked, [
        [0, 10], [10, 110], [120, 110], [230, 110], [340, 110], [450, 50]
      ])
      assert.equal(audio.frame, audio.blockSize)
      fakeEndPoint.ticked = []

      audio.tick()
      assert.equal(called, 9) // previous + 560, 670, 780, 890
      assert.deepEqual(fakeEndPoint.ticked, [
        [0, 60], [60, 110], [170, 110], [280, 110], [390, 110]
      ])
      assert.equal(audio.frame, 2 * audio.blockSize)
      fakeEndPoint.ticked = []

      audio.tick()
      assert.equal(called, 14) // previous + 1000, 1110, 1220, 1330, 1440
      assert.deepEqual(fakeEndPoint.ticked, [
        [0, 110], [110, 110], [220, 110], [330, 110], [440, 60]
      ])
      assert.equal(audio.frame, 3 * audio.blockSize)

    })

  })

  describe('DspInlet', function() {

    var DummyObject = function(dspOutlet) {
      this.nextBuf = null
      this.dspOutlet = new portlets.DspOutlet(this, 0)
    }

    DummyObject.prototype.tick = function(offset, length) {
      this.dspOutlet._buffer = this.nextBuf
      this.dspOutlet.setBufferRange(offset, length)
    }

    it('should run _runTick only once per frame', function() {
      var DspInlet = portlets.DspInlet.extend({
        init: function() { 
          portlets.DspInlet.prototype.init.apply(this, arguments)
          this.nextRet = null
        },
        _runTick: function() {
          this.ret = this.nextRet
        } 
      })

      var inlet = new DspInlet()

      // tick has never ran so it should run this time
      inlet.nextRet = 55
      inlet.tick()
      assert.equal(inlet.ret, 55)
      // the time hasn't advanced, so tick shouldn't change anything
      inlet.nextRet = 66
      inlet.tick()
      assert.equal(inlet.ret, 55)

      // Now we advance time, so tick should run
      audio.frame = 1
      inlet.nextRet = 77
      inlet.tick()
      assert.equal(inlet.ret, 77)
      // Time hasnt advanced so same result
      inlet.nextRet = 88
      inlet.tick()
      assert.equal(inlet.ret, 77)
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

    it('should return a zeros buffer [0 source]', function() {
      var dspInlet = new portlets.DspInlet({}, 0)
      dspInlet.start()

      dspInlet.tick(0, 10)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array(10))

      audio.frame = 10
      dspInlet.tick(10, 10)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array(10))
    })

    it('should pass over the buffer from source [1 source]', function() {
      var buf1 = new Float32Array(10)
      var buf2 = new Float32Array(10)
      var sourceObj = new DummyObject()
      var dspInlet = new portlets.DspInlet({}, 0)
      sourceObj.dspOutlet.connect(dspInlet)

      // To test that buffers are the same, we need to test that they share the same
      // underlying buffer and have same length and values, cause `getBuffer` returns 
      // a subarray.
      sourceObj.nextBuf = buf1
      dspInlet.tick(0, 10)
      assert.equal(dspInlet.getBuffer().buffer, buf1.buffer)
      assert.deepEqual(dspInlet.getBuffer(), buf1)

      audio.frame = 10
      sourceObj.nextBuf = buf2
      dspInlet.tick(0, 10)
      assert.equal(dspInlet.getBuffer().buffer, buf2.buffer)
      assert.deepEqual(dspInlet.getBuffer(), buf2)
    })

    it('should pass the right subarray [1 source]', function() {
      var sourceObj = new DummyObject()
      var dspInlet = new portlets.DspInlet({}, 0)
      sourceObj.dspOutlet.connect(dspInlet)

      sourceObj.nextBuf = new Float32Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ])
      dspInlet.tick(0, 5)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array([ 1, 2, 3, 4, 5 ]))

      audio.frame = 5
      dspInlet.tick(5, 5)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array([ 6, 7, 8, 9, 10 ]))

      audio.frame = 10
      sourceObj.nextBuf = new Float32Array([ 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 ])
      dspInlet.tick(0, 5)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array([ 11, 12, 13, 14, 15 ]))
    })

    it('should compute the sum of sources [N sources]', function() {
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
      dspInlet.tick(1, 4)
      assert.deepEqual(dspInlet.getBuffer(), new Float32Array([ 222, 333, 444, 555 ]))
    })

  })

  describe('DspObject', function() {

    it('should run tick of all dsp inlets once per-frame', function() {
      var called = []

      var Inlet = portlets.Inlet.extend({
        tick: function() { called.push([ this.id, pdGlob.audio.frame ]) }
      })

      var DummyInlet = portlets.DspInlet.extend({
        tick: function() { called.push([ this.id, pdGlob.audio.frame ]) }
      })

      // Inlet 1 should not be ran
      var DummyDspObject = engine.DspObject.extend({
        inletDefs: [ DummyInlet, portlets.Inlet, DummyInlet ],
        _runTick: function() {
          called.push([ 'obj', pdGlob.audio.frame ])
        }
      })

      var obj = new DummyDspObject()

      // Frame 0
      obj.tick()
      assert.deepEqual(called, [ 
        [0, 0], [2, 0], ['obj', 0] 
      ])

      // Frame 123
      pdGlob.audio.frame = 123
      obj.tick()
      assert.deepEqual(called, [
        [0, 0], [2, 0], ['obj', 0],
        [0, 123], [2, 123], ['obj', 123]
      ])
    })

    it('should set frame range of all dsp outlets', function() {
      var DummyDspObject = engine.DspObject.extend({
        outletDefs: [ portlets.DspOutlet, portlets.DspOutlet, portlets.DspOutlet ],
        _runTick: function() {}
      })

      var obj = new DummyDspObject()
      obj.o(0)._buffer = new Float32Array([ 1, 2, 3, 4, 5 ])
      obj.o(1)._buffer = new Float32Array([ 6, 7, 8, 9, 10 ])
      obj.o(2)._buffer = new Float32Array([ 11, 12, 13, 14, 15 ])

      obj.tick(1, 3)
      assert.deepEqual(obj.o(0).getBuffer(), new Float32Array([ 2, 3, 4 ]))
      assert.deepEqual(obj.o(1).getBuffer(), new Float32Array([ 7, 8, 9 ]))
      assert.deepEqual(obj.o(2).getBuffer(), new Float32Array([ 12, 13, 14 ]))
    })

  })  

})