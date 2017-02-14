var assert = require('assert')
var _ = require('underscore')
var interfaces = require('../../lib/js-dsp/interfaces')
var Pd = require('../../index')
var helpers = require('../helpers')

describe('js-dsp.interfaces', function() {

  afterEach(function() { helpers.afterEach() })

  describe('Clock', function() {

    var clock, audio
    beforeEach(function() {
      clock = new interfaces.Clock()
      audio = new helpers.TestAudio()
      audio.frame = 0
      audio.sampleRate = 44100
      audio.blockSize = 4410
      Pd.start({ clock: clock, audio: audio })
    })

    it('should just do nothing if no event', function() {
      var blockEnd

      // block 0
      blockEnd = audio.frame + audio.blockSize
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, audio.blockSize)

      // block 1
      blockEnd = audio.frame + audio.blockSize
      audio.frame = clock.tick(blockEnd)
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
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.95 * audio.sampleRate))
      assert.deepEqual(called, [])
      // next tick event called and advances of the remaining 0.05 seconds to make a complete block 
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, ['event1'])

      // Same idea, but since there are 2 events this time, the block is cut in 3
      audio.frame = 1.9 * audio.sampleRate
      blockEnd = 2.0 * audio.sampleRate
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(1.95 * audio.sampleRate))
      assert.deepEqual(called, ['event1'])

      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(1.975 * audio.sampleRate))
      assert.deepEqual(called, ['event1', 'event2'])

      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, ['event1', 'event2', 'event3'])
    })

    it('should schedule / execute events with repetition properly', function() {
      var called = 0

      // We schedule events in wrong order of execution to test insertion
      clock.schedule(function() { called++ }, 10, 25)

      // frame 0, the tick advances to the first event
      blockEnd = audio.frame + audio.blockSize
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.06 * audio.sampleRate))
      assert.deepEqual(called, 2)

      // Repetition 2
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.085 * audio.sampleRate))
      assert.deepEqual(called, 3)
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
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.06 * audio.sampleRate))
      assert.deepEqual(called, 2)

      // Repetition 2
      audio.frame = clock.tick(blockEnd)
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
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // unschedule
      clock.unschedule(event)
      audio.frame = clock.tick(blockEnd)
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
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.01 * audio.sampleRate))
      assert.deepEqual(called, 0)

      // Event called for first time
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, Math.floor(0.035 * audio.sampleRate))
      assert.deepEqual(called, 1)

      // Repetition 1
      audio.frame = clock.tick(blockEnd)
      assert.equal(audio.frame, blockEnd)
      assert.deepEqual(called, 2)

      // Event should have been unscheduled
      blockEnd = audio.frame + audio.blockSize
      audio.frame = clock.tick(blockEnd)
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
      var audio = new interfaces.Audio({ blockSize: 500 })
      audio.sampleRate = 1000
      var clock = new interfaces.Clock()
      audio.registerEndPoint(fakeEndPoint)
      Pd.start({ audio: audio, clock: clock })

      var called = 0

      // We schedule events in wrong order of execution to test insertion
      clock.schedule(function() { called++ }, 10, 110)
      
      audio.tick()
      assert.deepEqual(called, 5) // 10, 120, 230, 340, 450
      assert.deepEqual(fakeEndPoint.ticked, [
        [10, 0], [110, 10], [110, 120], [110, 230], [110, 340], [50, 450]
      ])
      assert.equal(audio.frame, audio.blockSize)
      fakeEndPoint.ticked = []

      audio.tick()
      assert.deepEqual(called, 9) // previous + 560, 670, 780, 890
      assert.deepEqual(fakeEndPoint.ticked, [
        [60, 0], [110, 60], [110, 170], [110, 280], [110, 390]
      ])
      assert.equal(audio.frame, 2 * audio.blockSize)
      fakeEndPoint.ticked = []

      audio.tick()
      assert.deepEqual(called, 14) // previous + 1000, 1110, 1220, 1330, 1440
      assert.deepEqual(fakeEndPoint.ticked, [
        [110, 0], [110, 110], [110, 220], [110, 330], [60, 440]
      ])
      assert.equal(audio.frame, 3 * audio.blockSize)

    })

  })

})