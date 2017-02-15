var assert = require('assert')
var _ = require('underscore')
var vectors = require('../../lib/js-dsp/vectors')
var helpers = require('../helpers')

describe('js-dsp.vectors', function() {

  // Common test suite for all vector arithmetic operations
  var vectorsArithmTestSuite = function(operationName, operation) {

    describe(operationName, function() {

      it('should ' + operationName + ' sources to destination', function() {
        var destination, sources
        destination = new Float32Array([ 1000, 2000, 3000, 4000 ])
        sources = [
          new Float32Array([ 1, 2, 3, 4 ]),
          new Float32Array([ 10, 20, 30, 40 ]),
          new Float32Array([ 100, 200, 300, 400 ]),
        ]
        vectors[operationName](destination, sources)
        
        expected = new Float32Array([
          operation(1, 10, 100),
          operation(2, 20, 200),
          operation(3, 30, 300),
          operation(4, 40, 400)  
        ])
        assert.deepEqual(destination, expected)
      })
    
    })

    describe(operationName + 'Constant', function() {

      it('should ' + operationName + ' source with constant to destination', function() {
        var destination, source
        destination = new Float32Array([ 1000, 2000, 3000, 4000 ])
        source = new Float32Array([ 1, 2, 3, 4 ])
        vectors[operationName + 'Constant'](destination, source, 0.5)

        expected = new Float32Array([
          operation(1, 0.5),
          operation(2, 0.5),
          operation(3, 0.5),
          operation(4, 0.5)
        ])
        assert.deepEqual(destination, expected)
      })
    
    })
  }

  vectorsArithmTestSuite('add', function(a, b, c) { return a + b + (c || 0) })
  vectorsArithmTestSuite('mult', function(a, b, c) { return a * b * (c || 1) })
  vectorsArithmTestSuite('sub', function(a, b, c) { return a - b - (c || 0) })
  vectorsArithmTestSuite('div', function(a, b, c) { return a / b / (c || 1) })
  vectorsArithmTestSuite('mod', function(a, b, c) { return a % b % (c || 1) })

  describe('cos', function() {

    it('should return the cos of phase if frequency is 0', function() {
      var destination = new Float32Array(4)
      vectors.cos(destination, 0, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 1, 1, 1, 1 ]))
      vectors.cos(destination, Math.PI / 2, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 0, 0, 0, 0 ]))
    })

    it('should compute the cos', function() {
      var destination = new Float32Array(4)
      var sampleRate = 44100
      var K = 2 * Math.PI * 440 / sampleRate
      var phase = 0

      phase = vectors.cos(destination, phase, K)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ Math.cos(K*1), Math.cos(K*2), Math.cos(K*3), Math.cos(K*4) ]))

      phase = vectors.cos(destination, phase, K)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ Math.cos(K*5), Math.cos(K*6), Math.cos(K*7), Math.cos(K*8) ]))
    })

  })

  describe('variableCos', function() {

    it('should compute the result with input frequencies', function() {
      var destination = new Float32Array(4)
      var J = 2 * Math.PI / 44100
      var phase = 0, newPhase

      newPhase = vectors.variableCos(destination, phase, J, [ 770, 550, 330, 110 ])
      helpers.assertAboutEqual(
        destination,
        new Float32Array([ Math.cos(phase + J * 770), Math.cos(phase + J * (770 + 550)), 
          Math.cos(phase + J * (770 + 550 + 330)), Math.cos(phase + J * (770 + 550 + 330 + 110)) ])
      )
      phase = newPhase

      newPhase = vectors.variableCos(destination, phase, J, [ 880, 440, 880, 440 ])
      helpers.assertAboutEqual(
        destination,
        new Float32Array([ Math.cos(phase + J * 880), Math.cos(phase + J * (880 + 440)), 
          Math.cos(phase + J * (880 + 440 + 880)), Math.cos(phase + J * (880 + 440 + 880 + 440)) ])
      )
    })

  })

  describe('phasor', function() {

    it('should return the phase if frequency is 0', function() {
      var destination = new Float32Array(4)
      vectors.phasor(destination, 0, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 0, 0, 0, 0 ]))
      vectors.phasor(destination, 0.5, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 0.5, 0.5, 0.5, 0.5 ]))
    })

    it('should compute the phasor', function() {
      var destination = new Float32Array(4)
      var sampleRate = 5
      var phase = 0

      phase = vectors.phasor(destination, phase, 1 / sampleRate)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ 0.2, 0.4, 0.6, 0.8 ]))

      phase = vectors.phasor(destination, phase, 1 / sampleRate)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ 0, 0.2, 0.4, 0.6 ]))


      phase = vectors.phasor(destination, phase, 0.5 / sampleRate)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ 0.7, 0.8, 0.9, 0 ]))
    })
  })

  describe('variablePhasor', function() {

    it('should compute the result with input frequencies', function() {
      var destination = new Float32Array(4)
      var sampleRate = 5
      var phase = 0.6 - 1 / sampleRate

      phase = vectors.variablePhasor(destination, phase, 1 / sampleRate, [ 1, 0.5, 0.2, 0.1 ])
      helpers.assertAboutEqual(destination, new Float32Array([ 0.6, 0.7, 0.74, 0.76 ]))
      phase = vectors.variablePhasor(destination, phase, 1 / sampleRate, [ 1, 0.5, 0.2, 0.1 ])
      helpers.assertAboutEqual(destination, new Float32Array([ 0.96, 0.06, 0.1, 0.12 ]))
    })

  })

  describe('triangle', function() {

    it('should return the phase if frequency is 0', function() {
      var destination = new Float32Array(4)
      vectors.triangle(destination, 0, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ -1, -1, -1, -1 ]))
      vectors.triangle(destination, 0.5, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 1, 1, 1, 1 ]))
      vectors.triangle(destination, 0.9, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ -0.6, -0.6, -0.6, -0.6 ]))
    })

    it('should compute the triangle', function() {
      var destination = new Float32Array(10)
      var sampleRate = 10
      var phase = 0

      phase = vectors.triangle(destination, phase, 1 / sampleRate)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ -0.6, -0.2, 0.2, 0.6, 1, 0.6, 0.2, -0.2, -0.6, -1 ]))
      assert.equal(helpers.round(phase), 1)
    })
  })

  describe('variableTriangle', function() {

    it('should compute the result with input frequencies', function() {
      var destination = new Float32Array(5)
      var sampleRate = 10
      var phase = 0

      phase = vectors.variableTriangle(destination, phase, 1 / sampleRate, [ 1, 0.5, 1, 0.75, 2 ])
      helpers.assertAboutEqual(destination, 
        new Float32Array([ -0.6, -0.4, 0, 0.3, 0.9 ]))
    })

  })

  describe('square', function() {

    it('should return the phase if frequency is 0', function() {
      var destination = new Float32Array(4)
      vectors.square(destination, 0, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ -1, -1, -1, -1 ]))
      vectors.square(destination, 0.5, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 1, 1, 1, 1 ]))
      vectors.square(destination, 0.9, 0)
      helpers.assertAboutEqual(destination, new Float32Array([ 1, 1, 1, 1 ]))
    })

    it('should compute the square', function() {
      var destination = new Float32Array(10)
      var sampleRate = 10
      var phase = 0

      phase = vectors.square(destination, phase, 1 / sampleRate)
      helpers.assertAboutEqual(destination, 
        new Float32Array([ -1, -1, -1, -1, 1, 1, 1, 1, 1, 1 ]))
      assert.equal(helpers.round(phase), 1)
    })
  })

  describe('variableSquare', function() {

    it('should compute the result with input frequencies', function() {
      var destination = new Float32Array(5)
      var sampleRate = 10
      var phase = 0

      phase = vectors.variableSquare(destination, phase, 1 / sampleRate, [ 1, 0.5, 1, 0.75, 2 ])
      helpers.assertAboutEqual(destination, 
        new Float32Array([ -1, -1, -1, -1, 1 ]))
    })

  })

  describe('ramp', function() {

    it('should generate the expected ramp', function() {
      var destination = new Float32Array(5)
      var value = vectors.ramp(destination, 0, 1/5)
      helpers.assertAboutEqual(destination,
        new Float32Array([ 1/5, 2/5, 3/5, 4/5, 1 ]))
      assert.equal(value, 1)
    })

  })

})