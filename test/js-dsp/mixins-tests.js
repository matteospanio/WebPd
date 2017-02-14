var assert = require('assert')
var _ = require('underscore')
var mixins = require('../../lib/js-dsp/mixins')
var Pd = require('../../index')
var helpers = require('../helpers')

describe('js-dsp.mixins', function() {

  afterEach(function() { helpers.afterEach() })

  describe('TickMixin', function() {

    var audio
    beforeEach(function() {
      audio = new helpers.TestAudio()
      audio.frame = 0
      audio.sampleRate = 44100
      audio.blockSize = 4410
      Pd.start({ audio: audio })
    })

    it('should run _runTick only once per frame', function() {
      var Node = function() { 
        this.nextRet = null 
        mixins.TickMixin.init.apply(this)
      }

      _.extend(Node.prototype, mixins.TickMixin, {
        _runTick: function() {
          this.ret = this.nextRet
        }
      })

      var node = new Node()

      // tick has never ran so it should run this time
      node.nextRet = 55
      node.tick()
      assert.equal(node.ret, 55)
      // the time hasn't advanced, so tick shouldn't change anything
      node.nextRet = 66
      node.tick()
      assert.equal(node.ret, 55)

      // Now we advance time, so tick should run
      audio.frame = 1
      node.nextRet = 77
      node.tick()
      assert.equal(node.ret, 77)
      // Time hasnt advanced so same result
      node.nextRet = 88
      node.tick()
      assert.equal(node.ret, 77)
    })

  })

})