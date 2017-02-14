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

exports.add = function(destination, sources) {
  var source, i, j
  var length = destination.length
  var sourceCount = sources.length

  source = sources[0]
  for (j = 0; j < length; j++)
    destination[j] = source[j]

  for (i = 1; i < sourceCount; i++) {
    source = sources[i]
    for (j = 0; j < length; j++)
      destination[j] += source[j]
  }
}

exports.addConstant = function(destination, source, constant) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++)
    destination[i] = source[i] + constant
}

exports.mult = function(destination, sources) {
  var source, i, j
  var length = destination.length
  var sourceCount = sources.length

  source = sources[0]
  for (j = 0; j < length; j++)
    destination[j] = source[j]

  for (i = 1; i < sourceCount; i++) {
    source = sources[i]
    for (j = 0; j < length; j++)
      destination[j] *= source[j]
  }
}

exports.multConstant = function(destination, source, constant) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++)
    destination[i] = source[i] * constant
}

exports.div = function(destination, sources) {
  var source, i, j
  var length = destination.length
  var sourceCount = sources.length

  source = sources[0]
  for (j = 0; j < length; j++)
    destination[j] = source[j]

  for (i = 1; i < sourceCount; i++) {
    source = sources[i]
    for (j = 0; j < length; j++)
      destination[j] /= source[j]
  }
}

exports.divConstant = function(destination, source, constant) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++)
    destination[i] = source[i] / constant
}

exports.sub = function(destination, sources) {
  var source, i, j
  var length = destination.length
  var sourceCount = sources.length

  source = sources[0]
  for (j = 0; j < length; j++)
    destination[j] = source[j]

  for (i = 1; i < sourceCount; i++) {
    source = sources[i]
    for (j = 0; j < length; j++)
      destination[j] -= source[j]
  }
}

exports.subConstant = function(destination, source, constant) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++)
    destination[i] = source[i] - constant
}

exports.mod = function(destination, sources) {
  var source, i, j
  var length = destination.length
  var sourceCount = sources.length

  source = sources[0]
  for (j = 0; j < length; j++)
    destination[j] = source[j]

  for (i = 1; i < sourceCount; i++) {
    source = sources[i]
    for (j = 0; j < length; j++)
      destination[j] %= source[j]
  }
}

exports.modConstant = function(destination, source, constant) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++)
    destination[i] = source[i] % constant
}

// K = freq * 2 * Math.PI  / sampleRate = freq * J
exports.cos = function(destination, phase, K) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++) {
    phase += K
    destination[i] = Math.cos(phase)
  }
  return phase
}

// J = 2 * Math.PI / sampleRate
exports.variableCos = function(destination, phase, J, frequencies) {
  var i
  var length = destination.length
  for (i = 0, length = destination.length; i < length; i++) {
    phase += J * frequencies[i]
    destination[i] = Math.cos(phase)
  }
  return phase
}

// K = freq * 1 / sampleRate = freq * J
exports.sawtooth = function(destination, phase, K) {
  var i
  var length = destination.length
  for (i = 0; i < length; i++) {
    phase = (phase + K) % 1
    destination[i] = phase
  }
  return phase
}

// J = 1 / sampleRate
exports.variableSawtooth = function(destination, phase, J, frequencies) {
  var i
  var length = destination.length
  for (i = 0, length = destination.length; i < length; i++) {
    phase = (phase + J * frequencies[i]) % 1
    destination[i] = phase
  }
  return phase
}
